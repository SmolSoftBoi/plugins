import { once } from 'node:events';
import { request } from 'node:http';
import { createInterface } from 'node:readline';

const affinityUrl = new URL('http://localhost:6767/sse');
const affinityProtocolVersion = '2025-11-25';
const connectionTimeoutMs = 5_000;
const acknowledgementTimeoutMs = 30_000;

function requestAffinity(url, options, body) {
  return new Promise((resolve, reject) => {
    // Use a direct socket even when the Node runtime has a global proxy configured.
    const outgoing = request(url, { ...options, agent: false }, resolve);
    outgoing.once('error', reject);
    outgoing.end(body);
  });
}

async function* readEvents(response) {
  response.setEncoding('utf8');
  let remainder = '';
  let trailingCr = false;
  let event = 'message';
  let data = [];

  for await (const chunk of response) {
    // A trailing CR already ended a line. A leading LF in the next chunk belongs to it.
    const start = trailingCr && chunk.startsWith('\n') ? 1 : 0;
    const lines = (remainder + chunk.slice(start)).split(/\r\n|\r|\n/);
    remainder = lines.pop();
    trailingCr = chunk.endsWith('\r');

    for (const line of lines) {
      if (line === '') {
        if (data.length > 0) yield { event, data: data.join('\n') };
        event = 'message';
        data = [];
      } else if (line.startsWith('event:')) {
        event = line.slice(6).replace(/^ /, '') || 'message';
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''));
      }
    }
  }
}

async function relayFromAffinity(events, signal) {
  for await (const { event, data } of events) {
    if (event !== 'message') continue;

    let message;
    try {
      message = JSON.parse(data);
    } catch {
      throw new Error('Affinity returned an invalid MCP message.');
    }

    if (!process.stdout.write(`${JSON.stringify(message)}\n`)) {
      await once(process.stdout, 'drain', { signal });
    }
  }

  throw new Error('Affinity closed the MCP connection. Start a new Codex chat to reconnect.');
}

async function relayToAffinity(input, endpoint, signal) {
  for await (const line of input) {
    if (!line.trim()) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      throw new Error('Codex sent an invalid MCP message.');
    }

    // Affinity rejects other protocol offers instead of negotiating its version.
    if (message.method === 'initialize') {
      message.params.protocolVersion = affinityProtocolVersion;
    }

    const body = JSON.stringify(message);
    const response = await requestAffinity(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(acknowledgementTimeoutMs)]),
    }, body);

    const { statusCode } = response;
    // The HTTP response acknowledges delivery. MCP results arrive on the event stream.
    for await (const _chunk of response) { /* Drain the acknowledgement. */ }
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`Affinity rejected an MCP message (HTTP ${statusCode}).`);
    }
  }
}

async function run() {
  const connection = new AbortController();
  const deadline = setTimeout(() => connection.abort(), connectionTimeoutMs);
  let input;

  try {
    const response = await requestAffinity(affinityUrl, {
      headers: { Accept: 'text/event-stream' },
      signal: connection.signal,
    });
    const contentType = response.headers['content-type']?.split(/[;,]/, 1)[0].trim().toLowerCase();
    if (response.statusCode !== 200 || contentType !== 'text/event-stream') {
      throw new Error('Affinity did not open an MCP event stream.');
    }

    const events = readEvents(response);
    const { value: firstEvent } = await events.next();
    if (firstEvent?.event !== 'endpoint' || !firstEvent.data.trim()) {
      throw new Error('Affinity did not advertise an MCP message endpoint.');
    }

    const endpoint = new URL(firstEvent.data, affinityUrl);
    if (endpoint.origin !== affinityUrl.origin || endpoint.username || endpoint.password) {
      throw new Error('Affinity advertised an invalid local MCP message endpoint.');
    }

    clearTimeout(deadline);
    input = createInterface({ input: process.stdin, crlfDelay: Infinity });
    await Promise.race([
      relayFromAffinity(events, connection.signal),
      relayToAffinity(input, endpoint, connection.signal),
    ]);
  } catch (error) {
    if (!input) {
      throw new Error(`Open Affinity and enable its MCP server in Settings. ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(deadline);
    connection.abort();
    input?.close();
  }
}

run().catch((error) => {
  console.error(`Affinity MCP: ${error.message}`);
  process.exitCode = 1;
});
