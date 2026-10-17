import React from "react";
import { describe, it, expect, vi, beforeEach, waitFor } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletProvider } from "@/providers/WalletProvider";
import { WalletContext } from "@/providers/WalletProvider";

vi.mock("@/util/wallet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/util/wallet")>();
  return {
    ...actual,
    wallet: {
      setWallet: vi.fn(),
      getAddress: vi.fn().mockResolvedValue({
        address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      }),
      getNetwork: vi.fn().mockResolvedValue({
        network: "TESTNET",
        networkPassphrase: "Testnet SDF Network ; September 2015",
      }),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
    getSupportedWallets: vi.fn().mockResolvedValue([]),
  };
});

const NetworkWarningDisplay: React.FC = () => {
  const ctx = React.useContext(WalletContext);
  return (
    <div>
      <span data-testid="warning-state">
        {ctx.networkSwitchWarning ? "SET" : "CLEAR"}
      </span>
      <button data-testid="ack-switch" onClick={ctx.acknowledgeNetworkSwitch}>
        Acknowledge
      </button>
    </div>
  );
};

describe("Network switch warning before signing (#694)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("sets a warning when the wallet switches networks and clears it on acknowledge", async () => {
    window.localStorage.setItem("walletId", "test-wallet");
    window.localStorage.setItem(
      "walletAddress",
      "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
    );

    render(
      <WalletProvider>
        <NetworkWarningDisplay />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("warning-state")).toHaveTextContent("CLEAR");
    });

    const user = userEvent.setup();

    fireEvent(
      window,
      new CustomEvent("stellar:networkChanged", { detail: { network: "PUBLIC" } })
    );

    await waitFor(() => {
      expect(screen.getByTestId("warning-state")).toHaveTextContent("SET");
    });

    await user.click(screen.getByTestId("ack-switch"));

    await waitFor(() => {
      expect(screen.getByTestId("warning-state")).toHaveTextContent("CLEAR");
    });
  });
});
