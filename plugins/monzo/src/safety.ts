export const MONEY_MOVEMENT_CONFIRMATION_ENV = "MONZO_MONEY_MOVEMENT_CONFIRMATION_TEXT";
export const ACCOUNT_CHANGE_CONFIRMATION_ENV = "MONZO_ACCOUNT_CHANGE_CONFIRMATION_TEXT";

export type MutationKind = "money" | "account";

export interface MutationConfirmation {
  confirm: boolean;
  confirmationText: string;
}

interface MutationConfirmationRequirement {
  label: string;
  envVar: string;
}

export function getMutationConfirmationRequirement(kind: MutationKind): MutationConfirmationRequirement {
  return kind === "money"
    ? {
        label: "money movement",
        envVar: MONEY_MOVEMENT_CONFIRMATION_ENV,
      }
    : {
        label: "account change",
        envVar: ACCOUNT_CHANGE_CONFIRMATION_ENV,
      };
}

export function assertMutationAllowed(
  env: NodeJS.ProcessEnv,
  kind: MutationKind,
  confirmation: MutationConfirmation,
): void {
  if (env.MONZO_ENABLE_MUTATIONS !== "true") {
    throw new Error("Mutating Monzo tools require MONZO_ENABLE_MUTATIONS=true.");
  }

  const requirement = getMutationConfirmationRequirement(kind);
  const expectedText = env[requirement.envVar];

  if (expectedText === undefined || expectedText.length === 0) {
    throw new Error(
      `Mutating Monzo tools require ${requirement.envVar} to be set to a private ${requirement.label} confirmation text.`,
    );
  }

  if (!confirmation.confirm || confirmation.confirmationText !== expectedText) {
    throw new Error(
      `Mutating Monzo tools require confirm=true and the private ${requirement.label} confirmation text configured in ${requirement.envVar}.`,
    );
  }
}
