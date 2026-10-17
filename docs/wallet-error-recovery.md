# Wallet error recovery

## Summary

When a wallet connect, reconnect, or sign flow fails, the app can show a
recovery modal
([`src/components/WalletErrorRecoveryModal.tsx`](../src/components/WalletErrorRecoveryModal.tsx))
that explains the failure, offers one-click recovery, and exposes a copyable
diagnostic report. The report is built by
[`src/lib/wallet/diagnostics.ts`](../src/lib/wallet/diagnostics.ts).

The modal is opened from the wallet button's error message (the **Recover**
action) and can be reused anywhere the wallet reports an error.

## What the modal shows

- A plain-language explanation mapped from the raw error
  (`classifyWalletError`), for example "Signature declined" or "Wallet not
  funded".
- Ordered recovery steps tailored to that error class.
- A redacted diagnostic report with the wallet id, network, network match
  status, RPC/Horizon URLs, online state, and error type/code.
- Actions: **Retry connection**, **Disconnect**, and **Close**.

## Diagnostics and privacy

The report deliberately contains no secrets:

- Account addresses are redacted to `GABC…4567` before display and copy.
- Only the wallet id, network names, and public endpoint URLs are included.
- Error messages and the user agent are truncated defensively.

Example output:

```text
PromptHash wallet diagnostics
Generated: 2026-01-01T00:00:00.000Z
Status: error
Wallet: freighter
Account (redacted): GABC…4567
Wallet network: PUBLIC
App network: TESTNET
Network match: no
RPC URL: https://soroban-testnet.stellar.org
Horizon URL: https://horizon-testnet.stellar.org
Online: yes
Error type: WalletError
Error code: wrong-network
Error: Wrong network passphrase
User agent: Mozilla/5.0 … (truncated)
```

## Recovery classes

`classifyWalletError` recognises user-rejected signatures, insufficient
balance, missing trustlines, wrong network, unavailable/locked wallets,
timeouts, and authorization failures, and falls back to the shared
`mapTechnicalError` mapping (see
[`src/lib/wallet/networkDetection.ts`](../src/lib/wallet/networkDetection.ts))
for anything else.

## Compatibility

This change is backward compatible. The existing inline error message still
appears; the modal is an additional, opt-in path plus a support-friendly
diagnostic export.
