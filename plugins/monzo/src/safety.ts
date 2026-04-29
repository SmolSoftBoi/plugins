export const MONEY_MOVEMENT_CONFIRMATION = "MOVE MONEY IN MONZO";
export const ACCOUNT_CHANGE_CONFIRMATION = "CHANGE MY MONZO ACCOUNT";

export type MutationKind = "money" | "account";

export interface MutationConfirmation {
  confirm: boolean;
  confirmationText: string;
}

export function assertMutationAllowed(
  env: NodeJS.ProcessEnv,
  kind: MutationKind,
  confirmation: MutationConfirmation,
): void {
  if (env.MONZO_ENABLE_MUTATIONS !== "true") {
    throw new Error("Mutating Monzo tools require MONZO_ENABLE_MUTATIONS=true.");
  }

  const expectedText =
    kind === "money" ? MONEY_MOVEMENT_CONFIRMATION : ACCOUNT_CHANGE_CONFIRMATION;

  if (!confirmation.confirm || confirmation.confirmationText !== expectedText) {
    throw new Error(`Mutating Monzo tools require confirm=true and confirmationText="${expectedText}".`);
  }
}
