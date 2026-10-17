import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkSelector } from "@/components/NetworkSelector";
import {
  NETWORK_PREFERENCE_STORAGE_KEY,
  SUPPORTED_NETWORKS,
} from "@/lib/stellar/networks";

describe("NetworkSelector", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders every supported network as an option", () => {
    render(<NetworkSelector />);
    const select = screen.getByTestId("network-selector") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(SUPPORTED_NETWORKS.map((network) => network.id));
  });

  it("persists the preference and notifies the caller when controlled", () => {
    const onChange = vi.fn();
    render(<NetworkSelector value="TESTNET" onChange={onChange} />);

    fireEvent.change(screen.getByTestId("network-selector"), {
      target: { value: "PUBLIC" },
    });

    expect(onChange).toHaveBeenCalledWith("PUBLIC");
    expect(window.localStorage.getItem(NETWORK_PREFERENCE_STORAGE_KEY)).toBe(
      "PUBLIC",
    );
  });

  it("defaults to a stored preference", () => {
    window.localStorage.setItem(NETWORK_PREFERENCE_STORAGE_KEY, "FUTURENET");
    render(<NetworkSelector />);
    const select = screen.getByTestId("network-selector") as HTMLSelectElement;
    expect(select.value).toBe("FUTURENET");
  });

  it("associates its label with the select control", () => {
    render(<NetworkSelector />);
    expect(screen.getByLabelText("Network")).toBe(
      screen.getByTestId("network-selector"),
    );
  });
});
