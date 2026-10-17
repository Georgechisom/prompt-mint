// Issue #683: Add a wallet account switching confirmation flow
// Confirms user intent when switching wallet accounts

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface WalletAccount {
  address: string;
  publicKey: string;
  network: 'testnet' | 'mainnet';
  label?: string;
}

interface WalletSwitchConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: WalletAccount | null;
  newAccount: WalletAccount;
  onConfirm: (account: WalletAccount) => Promise<void>;
}

export const WalletSwitchConfirmation: React.FC<WalletSwitchConfirmationProps> = ({
  isOpen,
  onClose,
  currentAccount,
  newAccount,
  onConfirm,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);

    try {
      await onConfirm(newAccount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch account');
    } finally {
      setIsConfirming(false);
    }
  };

  const networkMismatch = currentAccount?.network !== newAccount.network;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Account Switch</DialogTitle>
          <DialogDescription>
            You are about to switch to a different wallet account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Account */}
          {currentAccount && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Current Account</h4>
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Address</span>
                  <span className="font-mono text-sm">{formatAddress(currentAccount.address)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">Network</span>
                  <span className="text-sm capitalize">{currentAccount.network}</span>
                </div>
                {currentAccount.label && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">Label</span>
                    <span className="text-sm">{currentAccount.label}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* New Account */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">New Account</h4>
            <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Address</span>
                <span className="font-mono text-sm">{formatAddress(newAccount.address)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">Network</span>
                <span className="text-sm capitalize">{newAccount.network}</span>
              </div>
              {newAccount.label && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">Label</span>
                  <span className="text-sm">{newAccount.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Network Mismatch Warning */}
          {networkMismatch && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Warning:</strong> You are switching to a different network. This will affect which assets and contracts you can interact with.
              </AlertDescription>
            </Alert>
          )}

          {/* Impact Notice */}
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Switching accounts will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Update your active wallet address</li>
                <li>Refresh your token balances</li>
                <li>Clear pending transactions</li>
                {networkMismatch && <li className="font-semibold">Change your network to {newAccount.network}</li>}
              </ul>
            </AlertDescription>
          </Alert>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1"
          >
            {isConfirming ? 'Switching...' : 'Confirm Switch'}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isConfirming}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
