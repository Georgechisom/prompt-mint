# Footer network selector

## Summary

The footer now includes a network selector
([`src/components/NetworkSelector.tsx`](../src/components/NetworkSelector.tsx))
that lists every supported Stellar network and lets visitors record a
preference. The catalog lives in
[`src/lib/stellar/networks.ts`](../src/lib/stellar/networks.ts) and is shared
with the [multi-network status page](./multi-network-status.md).

## Behavior

- The dropdown lists **Mainnet**, **Testnet**, **Futurenet**, and **Local /
  Standalone**, and marks the network this build is actually configured for
  with an `(active)` suffix and an **Active** badge.
- Selecting a network persists the preference to
  `localStorage` under `prompt-mint:preferred-network` and notifies local
  subscribers (for example a second selector on the status page).
- A hint line shows the selected network's block explorer-friendly label and
  RPC URL.

## Active versus preferred

The app signs against the network it was built for
(`PUBLIC_STELLAR_NETWORK`, see [environments](./environments.md)). The selector
records a *preference*; it does not silently re-point a running build at a
different network. The preference is used for display and is picked up on the
next session.

## Accessibility

The selector is a native `<select>` with an associated `<label htmlFor>`, so it
is keyboard operable and screen-reader friendly without custom widgets.

## Compatibility

This change is backward compatible. If `localStorage` is unavailable the
selector falls back to the active build network and simply does not persist the
choice.
