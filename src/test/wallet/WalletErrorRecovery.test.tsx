import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { WalletErrorRecoveryModal } from "@/components/WalletErrorRecoveryModal";
import {
  buildWalletDiagnostics,
  classifyWalletError,
  formatWalletDiagnostics,
  redactAccount,
} from "@/lib/wallet/diagnostics";

const ACCOUNT = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

describe("wallet diagnostics", () => {
  it("redacts account addresses", () => {
    expect(redactAccount(ACCOUNT)).toBe("GABC…4567");
    expect(redactAccount(null)).toBeNull();
    expect(redactAccount("SHORT")).toBe("SHORT");
  });

  it("classifies common wallet errors into actionable guidance", () => {
    expect(classifyWalletError("User rejected the request").code).toBe("user-rejected");
    expect(classifyWalletError("op_underfunded while submitting").code).toBe("insufficient-balance");
    expect(classifyWalletError("Request timed out").code).toBe("timeout");
    expect(classifyWalletError("wrong network passphrase").code).toBe("wrong-network");
    expect(classifyWalletError("something odd").code).toBe("unknown");
  });

  it("builds a redacted report and formats it without exposing the full address", () => {
    const report = buildWalletDiagnostics({
      error: "User rejected the request",
      walletId: "freighter",
      address: ACCOUNT,
      status: "error",
      network: "PUBLIC",
      appNetwork: "TESTNET",
      generatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(report.account).toBe("GABC…4567");
    expect(report.accountRedacted).toBe(true);
    expect(report.networkMatch).toBe(false);
    expect(report.error?.code).toBe("user-rejected");

    const text = formatWalletDiagnostics(report);
    expect(text).toContain("PromptHash wallet diagnostics");
    expect(text).toContain("Error code: user-rejected");
    expect(text).not.toContain(ACCOUNT);
  });
});

describe("WalletErrorRecoveryModal", () => {
  it("renders nothing when closed", () => {
    renderWithProviders(
      <WalletErrorRecoveryModal open={false} onClose={() => {}} error="boom" />,
    );
    expect(screen.queryByTestId("wallet-error-recovery-modal")).not.toBeInTheDocument();
  });

  it("shows guidance and redacted diagnostics for the current error", () => {
    renderWithProviders(
      <WalletErrorRecoveryModal
        open
        onClose={() => {}}
        error="User rejected the request"
        onRetry={() => {}}
      />,
      {
        wallet: { address: ACCOUNT, status: "error", network: "TESTNET" },
      },
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Signature declined" })).toBeInTheDocument();

    const output = screen.getByTestId("wallet-diagnostics-output").textContent ?? "";
    expect(output).toContain("GABC…4567");
    expect(output).not.toContain(ACCOUNT);
  });

  it("wires the recovery actions", () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <WalletErrorRecoveryModal
        open
        onClose={onClose}
        error="Request timed out"
        onRetry={onRetry}
      />,
      { wallet: { status: "error" } },
    );

    fireEvent.click(screen.getByRole("button", { name: /retry connection/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
