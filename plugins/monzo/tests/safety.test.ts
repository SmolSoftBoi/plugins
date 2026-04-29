import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCOUNT_CHANGE_CONFIRMATION,
  MONEY_MOVEMENT_CONFIRMATION,
  assertMutationAllowed,
} from "../src/safety.js";

describe("assertMutationAllowed", () => {
  it("blocks mutations when the environment flag is absent", () => {
    assert.throws(() =>
      assertMutationAllowed(
        {},
        "account",
        {
          confirm: true,
          confirmationText: ACCOUNT_CHANGE_CONFIRMATION,
        },
      ),
    );
  });

  it("blocks account changes without the exact confirmation text", () => {
    assert.throws(() =>
      assertMutationAllowed(
        { MONZO_ENABLE_MUTATIONS: "true" },
        "account",
        {
          confirm: true,
          confirmationText: MONEY_MOVEMENT_CONFIRMATION,
        },
      ),
    );
  });

  it("allows account changes with the exact confirmation text", () => {
    assert.doesNotThrow(() =>
      assertMutationAllowed(
        { MONZO_ENABLE_MUTATIONS: "true" },
        "account",
        {
          confirm: true,
          confirmationText: ACCOUNT_CHANGE_CONFIRMATION,
        },
      ),
    );
  });

  it("allows money movement only with the money movement phrase", () => {
    assert.doesNotThrow(() =>
      assertMutationAllowed(
        { MONZO_ENABLE_MUTATIONS: "true" },
        "money",
        {
          confirm: true,
          confirmationText: MONEY_MOVEMENT_CONFIRMATION,
        },
      ),
    );
  });
});
