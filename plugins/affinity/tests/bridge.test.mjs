import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { text } from 'node:stream/consumers';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const compatibility = JSON.parse(await readFile(resolve(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
const initialised = { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-11-25' } };
const testOptions = { timeout: 8_000 };

async function startBridge(t, {
  portable = true,
  opening = 'event: endpoint\ndata: /message\n\n',
  reply = `data: ${JSON.stringify(initialised)}\n\n`,
} = {}) {
  const configPath = portable ? 'mcp.json' : compatibility.mcpServers;
  const config = JSON.parse(await readFile(resolve(pluginRoot, configPath), 'utf8'));
  const { command, args, cwd } = config.mcpServers.affinity;
  const expand = value => portable ? value.replaceAll('${PLUGIN_ROOT}', pluginRoot) : value;

  let events;
  let connections = 0;
  const requests = [];
  const fixture = createServer(async (incoming, response) => {
    if (incoming.method === 'GET') {
      connections++;
      events = response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      events.write(opening);
      return;
    }

    const message = JSON.parse(await text(incoming));
    requests.push(message);
    response.writeHead(202).end(() => {
      if (message.method === 'initialize') events.write(reply);
      if (message.method === 'tools/call') events.destroy();
    });
  });
  fixture.listen(0, '127.0.0.1');
  await once(fixture, 'listening');
  t.after(() => {
    fixture.closeAllConnections();
    fixture.close();
  });

  // Redirect the child to an ephemeral fixture port so it can never edit the running app.
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const preload = `
    import http from 'node:http';
    import { syncBuiltinESMExports } from 'node:module';
    const request = http.request;
    http.request = (url, ...args) => request(new URL(url.pathname + url.search, ${JSON.stringify(origin)}), ...args);
    syncBuiltinESMExports();
  `;
  const bridge = spawn(command, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, ...args.map(expand)], {
    cwd: resolve(pluginRoot, expand(cwd)),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const exited = new Promise(done => bridge.once('close', (code, signal) => done([code, signal])));
  const output = createInterface({ input: bridge.stdout })[Symbol.asyncIterator]();
  const errors = text(bridge.stderr);
  t.after(async () => {
    bridge.kill();
    await exited;
  });
  await once(bridge, 'spawn');

  const send = message => bridge.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  send({ id: 1, method: 'initialize', params: { protocolVersion: '2026-07-28' } });
  const result = await output.next();
  if (result.done) assert.fail(await errors);
  assert.deepEqual(JSON.parse(result.value), initialised);

  return { bridge, exited, output, errors, send, requests, connectionCount: () => connections };
}

test('the compatibility manifest starts the bridge with relative paths', testOptions, async t => {
  const { bridge, exited } = await startBridge(t, { portable: false });
  bridge.stdin.end();
  assert.deepEqual(await exited, [0, null]);
});

test('the portable manifest starts the bridge with CR-only SSE', testOptions, async t => {
  const { bridge, exited } = await startBridge(t, {
    opening: 'event: endpoint\rdata: /message\r\r',
    reply: `data: ${JSON.stringify(initialised)}\r\r`,
  });
  bridge.stdin.end();
  assert.deepEqual(await exited, [0, null]);
});

test('a CRLF pair split across reads preserves data already in the event', testOptions, async t => {
  const { bridge, exited } = await startBridge(t, {
    // The fixture sends the LF after receiving initialize, so the CR is read separately.
    opening: 'event: endpoint\r\ndata: /message\r\n\r\ndata: {\r',
    reply: `\ndata: ${JSON.stringify(initialised).slice(1)}\r\n\r\n`,
  });
  bridge.stdin.end();
  assert.deepEqual(await exited, [0, null]);
});

test('an accepted edit is never resent when the event stream drops before its result', testOptions, async t => {
  const { exited, output, errors, send, requests, connectionCount } = await startBridge(t);
  send({ id: 2, method: 'tools/call', params: { name: 'execute_script', arguments: { script: '// fixture' } } });

  assert.deepEqual(await exited, [1, null]);
  assert.deepEqual(requests.map(({ method }) => method), ['initialize', 'tools/call']);
  assert.equal(requests[1].params.name, 'execute_script');
  assert.equal(connectionCount(), 1);
  assert.equal((await output.next()).done, true);
  assert.match(await errors, /^Affinity MCP: /);
});
