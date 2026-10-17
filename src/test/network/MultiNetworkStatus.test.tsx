import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/navigation", () => ({
  Navigation: () => null,
}));

vi.mock("@/components/footer", () => ({
  Footer: () => null,
}));

import MultiNetworkStatusPage from "@/pages/status/networks";
import {
  NETWORK_SUPPORT_MATRIX,
  getNetworkSupportEntry,
  listNetworksMissingSupport,
  summarizeNetworkSupport,
  supportLevelLabel,
} from "@/lib/stellar/networkSupport";
import { NETWORK_PREFERENCE_STORAGE_KEY } from "@/lib/stellar/networks";

describe("multi-network support matrix", () => {
  it("has a support entry for every supported network", () => {
    expect(listNetworksMissingSupport()).toEqual([]);
    expect(NETWORK_SUPPORT_MATRIX).toHaveLength(4);
  });

  it("summarizes fully supported, partial, and unsupported networks", () => {
    const summary = summarizeNetworkSupport();
    expect(summary.total).toBe(4);
    expect(summary.fullySupported).toBe(2); // PUBLIC + TESTNET
    expect(summary.partial).toBe(2); // FUTURENET + LOCAL
    expect(summary.unsupported).toBe(0);
  });

  it("labels support levels for the UI", () => {
    expect(supportLevelLabel("supported")).toBe("Supported");
    expect(supportLevelLabel("beta")).toBe("Beta");
    expect(supportLevelLabel("unsupported")).toBe("Not supported");
  });

  it("returns the entry for a network id", () => {
    expect(getNetworkSupportEntry("TESTNET")?.networkId).toBe("TESTNET");
    expect(getNetworkSupportEntry("PUBLIC")?.writes).toBe("supported");
  });
});

describe("MultiNetworkStatusPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(NETWORK_PREFERENCE_STORAGE_KEY, "TESTNET");
  });

  it("renders a card per network with the support matrix", () => {
    render(<MultiNetworkStatusPage />);

    expect(screen.getByTestId("multi-network-status-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Multi-network support" }),
    ).toBeInTheDocument();

    for (const entry of NETWORK_SUPPORT_MATRIX) {
      expect(
        screen.getByTestId(`network-support-${entry.networkId}`),
      ).toBeInTheDocument();
    }
  });

  it("shows the summary counts and the active network", () => {
    render(<MultiNetworkStatusPage />);

    expect(screen.getByTestId("active-network-summary")).toBeInTheDocument();
    expect(screen.getByText("Fully supported")).toBeInTheDocument();
    expect(screen.getByText("Partial / beta")).toBeInTheDocument();
    expect(screen.getByTestId("network-selector")).toBeInTheDocument();
  });
});
