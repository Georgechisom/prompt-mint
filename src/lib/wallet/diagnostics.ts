import { horizonUrl as envHorizonUrl, rpcUrl as envRpcUrl, stellarNetwork } from "@/lib/env";
import { mapTechnicalError } from "@/lib/wallet/networkDetection";

/**
 * Wallet error diagnostics (#685).
 *
 * When a wallet connect/reconnect/sign fails, the user (and whoever helps
 * them) needs a plain-language explanation plus enough environment detail to
 * reproduce the problem — without leaking anything sensitive. This module
 * turns the raw wallet context into a small, structured report and a copyable
 * text block for the recovery modal.
 *
 * Privacy rules baked in here:
 * - account addresses are redacted before they are shown or copied,
 * - only the wallet id, network, and public endpoint URLs are included,
 * - user-agent strings are truncated.
 */

export type WalletRecoveryCode =
  | "user-rejected"
  | "insufficient-balance"
  | "trustline-missing"
  | "wrong-network"
  | "wallet-unavailable"
  | "timeout"
  | "authorization"
  | "unknown";

export interface WalletRecoveryGuidance {
  code: WalletRecoveryCode;
  title: string;
  /** Short, user-facing explanation. */
  message: string;
  /** Ordered recovery steps. */
  steps: string[];
}

export interface WalletDiagnosticError {
  name: string;
  /** Raw message, truncated defensively. */
  message: string;
  /** User-facing message produced by the shared error mapper. */
  mappedMessage: string;
  code: WalletRecoveryCode;
}

export interface WalletDiagnosticInput {
  error?: unknown;
  walletId?: string | null;
  address?: string | null;
  status?: string | null;
  network?: string | null;
  networkPassphrase?: string | null;
  rpcUrl?: string | null;
  horizonUrl?: string | null;
  appNetwork?: string | null;
  online?: boolean | null;
  userAgent?: string | null;
  generatedAt?: Date;
}

export interface WalletDiagnosticReport {
  generatedAt: string;
  status: string;
  walletId: string;
  /** Redacted account, safe to display. */
  account: string | null;
  accountRedacted: boolean;
  walletNetwork: string;
  appNetwork: string;
  networkPassphrase: string;
  networkMatch: boolean | null;
  rpcUrl: string;
  horizonUrl: string;
  online: boolean;
  userAgent: string;
  error: WalletDiagnosticError | null;
  guidance: WalletRecoveryGuidance | null;
}

const MAX_ERROR_MESSAGE_LENGTH = 400;
const MAX_USER_AGENT_LENGTH = 160;

/** Shortens an account to `GABC…WXYZ` so a screenshot never reveals the key. */
export function redactAccount(address?: string | null): string | null {
  if (!address) {
    return null;
  }
  const trimmed = address.trim();
  if (trimmed.length <= 10) {
    return trimmed;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function errorMessageOf(error: unknown): string {
  if (!error) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorNameOf(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return "WalletError";
}

/**
 * Maps an error message to actionable guidance. Falls back to the shared
 * technical-error mapper when nothing more specific matches.
 */
export function classifyWalletError(error: unknown): WalletRecoveryGuidance {
  const raw = errorMessageOf(error);
  const lower = raw.toLowerCase();

  const guidance = (
    code: WalletRecoveryCode,
    title: string,
    message: string,
    steps: string[],
  ): WalletRecoveryGuidance => ({ code, title, message, steps });

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected in your wallet")) {
    return guidance(
      "user-rejected",
      "Signature declined",
      "The request was rejected in the wallet before it was signed.",
      [
        "Open the recovery modal again and choose Retry.",
        "Approve the request in your wallet extension.",
        "If your wallet is on the wrong account, switch accounts first.",
      ],
    );
  }

  if (lower.includes("op_underfunded") || lower.includes("insufficient") || lower.includes("not funded")) {
    return guidance(
      "insufficient-balance",
      "Wallet not funded",
      "The account does not have enough XLM to pay fees or the amount.",
      [
        "Fund the account on testnet with Friendbot or send XLM to it.",
        "Wait for the balance to update, then retry the connection.",
      ],
    );
  }

  if (lower.includes("op_no_trust") || lower.includes("trustline")) {
    return guidance(
      "trustline-missing",
      "Missing asset trustline",
      "The account is missing a trustline required for this asset.",
      [
        "Add the asset trustline from your wallet.",
        "Reconnect once the trustline is authorized.",
      ],
    );
  }

  if (lower.includes("wrong network") || lower.includes("network mismatch") || lower.includes("passphrase")) {
    return guidance(
      "wrong-network",
      "Wallet on the wrong network",
      "The wallet is connected to a different Stellar network than this app.",
      [
        "Switch the network in your wallet extension to match the app network.",
        "Reconnect the wallet so the app can re-read the network.",
      ],
    );
  }

  if (lower.includes("not detected") || lower.includes("not available") || lower.includes("no provider") || lower.includes("locked")) {
    return guidance(
      "wallet-unavailable",
      "Wallet unavailable",
      "The wallet extension is locked, not installed, or did not respond.",
      [
        "Unlock the wallet extension in your browser.",
        "Make sure the extension is installed and enabled for this site.",
        "Refresh the page and try connecting again.",
      ],
    );
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return guidance(
      "timeout",
      "Wallet timed out",
      "The wallet did not respond in time.",
      [
        "Check that you are online and the wallet extension is responsive.",
        "Retry the connection.",
      ],
    );
  }

  if (lower.includes("auth") || lower.includes("signature") || lower.includes("sign")) {
    return guidance(
      "authorization",
      "Authorization failed",
      "The wallet could not authorize the request.",
      [
        "Re-approve the request in the wallet.",
        "If it keeps failing, disconnect and reconnect the wallet.",
      ],
    );
  }

  return guidance(
    "unknown",
    "Something went wrong",
    mapTechnicalError(raw || "Unknown wallet error"),
    [
      "Check that the wallet extension is unlocked and on the correct network.",
      "Copy the diagnostics below and retry the connection.",
      "If the problem continues, share the diagnostics with support.",
    ],
  );
}

/** Builds a redacted, structured diagnostic report from wallet context. */
export function buildWalletDiagnostics(
  input: WalletDiagnosticInput = {},
): WalletDiagnosticReport {
  const rawError = input.error;
  const walletNetwork = input.network ?? "";
  const appNetwork = input.appNetwork ?? stellarNetwork;
  const normalizedWallet = walletNetwork.toUpperCase();
  const normalizedApp = (appNetwork ?? "").toUpperCase();

  const networkMatch =
    walletNetwork && appNetwork ? normalizedWallet === normalizedApp : null;

  const account = redactAccount(input.address);

  const error: WalletDiagnosticError | null = rawError
    ? {
        name: errorNameOf(rawError),
        message: truncate(errorMessageOf(rawError), MAX_ERROR_MESSAGE_LENGTH),
        mappedMessage: mapTechnicalError(errorMessageOf(rawError)),
        code: classifyWalletError(rawError).code,
      }
    : null;

  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    status: input.status ?? "unknown",
    walletId: input.walletId ?? "not set",
    account,
    accountRedacted: Boolean(input.address && account !== input.address),
    walletNetwork: walletNetwork || "unknown",
    appNetwork: appNetwork || "unknown",
    networkPassphrase: input.networkPassphrase ?? "",
    networkMatch,
    rpcUrl: input.rpcUrl ?? envRpcUrl,
    horizonUrl: input.horizonUrl ?? envHorizonUrl,
    online: input.online ?? (typeof navigator === "undefined" ? true : navigator.onLine),
    userAgent: truncate(
      input.userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent),
      MAX_USER_AGENT_LENGTH,
    ),
    error,
    guidance: rawError ? classifyWalletError(rawError) : null,
  };
}

/** Formats the report as a plain-text block that is safe to paste/share. */
export function formatWalletDiagnostics(report: WalletDiagnosticReport): string {
  const lines = [
    "PromptHash wallet diagnostics",
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Wallet: ${report.walletId}`,
    `Account (redacted): ${report.account ?? "not connected"}`,
    `Wallet network: ${report.walletNetwork}`,
    `App network: ${report.appNetwork}`,
    `Network match: ${report.networkMatch === null ? "unknown" : report.networkMatch ? "yes" : "no"}`,
    `RPC URL: ${report.rpcUrl}`,
    `Horizon URL: ${report.horizonUrl}`,
    `Online: ${report.online ? "yes" : "no"}`,
  ];

  if (report.error) {
    lines.push(
      `Error type: ${report.error.name}`,
      `Error code: ${report.error.code}`,
      `Error: ${report.error.message}`,
    );
  } else {
    lines.push("Error: none");
  }

  lines.push(`User agent: ${report.userAgent || "unknown"}`);
  return lines.join("\n");
}
