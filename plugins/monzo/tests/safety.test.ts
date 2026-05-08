import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCOUNT_CHANGE_CONFIRMATION_ENV,
  MONEY_MOVEMENT_CONFIRMATION_ENV,
  assertMutationAllowed,
} from "../src/safety.js";

const privateAccountChangeConfirmation = "private-account-change-confirmation";
const privateMoneyMovementConfirmation = "private-money-movement-confirmation";

const mutationEnv: NodeJS.ProcessEnv = {
  MONZO_ENABLE_MUTATIONS: "true",
  [ACCOUNT_CHANGE_CONFIRMATION_ENV]: privateAccountChangeConfirmation,
  [MONEY_MOVEMENT_CONFIRMATION_ENV]: privateMoneyMovementConfirmation,
};

describe("assertMutationAllowed", () => {
  it("blocks mutations when the environment flag is absent", () => {
    assert.throws(() =>
      assertMutationAllowed(
        {},
        "account",
        {
          confirm: true,
          confirmationText: privateAccountChangeConfirmation,
        },
      ),
    );
  });

  it("blocks mutations when the private confirmation text is not configured", () => {
    assert.throws(() =>
      assertMutationAllowed(
        { MONZO_ENABLE_MUTATIONS: "true" },
        "account",
        {
          confirm: true,
          confirmationText: privateAccountChangeConfirmation,
        },
      ),
      new RegExp(ACCOUNT_CHANGE_CONFIRMATION_ENV),
    );
  });

  it("blocks account changes without the configured private confirmation text", () => {
    assert.throws(() =>
      assertMutationAllowed(
        mutationEnv,
        "account",
        {
          confirm: true,
          confirmationText: privateMoneyMovementConfirmation,
        },
      ),
    );
  });

  it("blocks account changes when confirm is false even with the configured private confirmation text", () => {
    assert.throws(() =>
      assertMutationAllowed(
        mutationEnv,
        "account",
        {
          confirm: false,
          confirmationText: privateAccountChangeConfirmation,
        },
      ),
    );
  });

  it("does not leak the configured private confirmation text in errors", () => {
    assert.throws(
      () =>
        assertMutationAllowed(
          mutationEnv,
          "account",
          {
            confirm: true,
            confirmationText: "wrong-confirmation",
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message.includes(privateAccountChangeConfirmation), false);
        return true;
      },
    );
  });

  it("allows account changes with the configured private confirmation text", () => {
    assert.doesNotThrow(() =>
      assertMutationAllowed(
        mutationEnv,
        "account",
        {
          confirm: true,
          confirmationText: privateAccountChangeConfirmation,
        },
      ),
    );
  });

  it("allows money movement only with the configured private confirmation text", () => {
    assert.doesNotThrow(() =>
      assertMutationAllowed(
        mutationEnv,
        "money",
        {
          confirm: true,
          confirmationText: privateMoneyMovementConfirmation,
        },
      ),
    );
  });
});
