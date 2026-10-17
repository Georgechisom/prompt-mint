import React, { useState } from "react";
import { Card, Button } from "@stellar/design-system";

interface Permission {
  id: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
}

interface WalletPermissionsPanelProps {
  permissions?: Permission[];
  onApprove?: () => void;
  onReject?: () => void;
  isProcessing?: boolean;
}

const defaultPermissions: Permission[] = [
  {
    id: "sign_transactions",
    name: "Sign Transactions",
    description:
      "Allows this app to request your wallet to sign transactions. You will always be prompted to approve each transaction.",
    riskLevel: "low",
  },
  {
    id: "read_public_key",
    name: "Read Public Key",
    description:
      "Allows this app to read your wallet's public key for identification purposes.",
    riskLevel: "low",
  },
  {
    id: "invoke_contracts",
    name: "Invoke Smart Contracts",
    description:
      "Allows this app to invoke smart contracts on Soroban. You will approve each contract invocation.",
    riskLevel: "medium",
  },
];

const getRiskColor = (level: "low" | "medium" | "high"): string => {
  switch (level) {
    case "low":
      return "text-emerald-400";
    case "medium":
      return "text-yellow-400";
    case "high":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
};

const WalletPermissionsPanel: React.FC<WalletPermissionsPanelProps> = ({
  permissions = defaultPermissions,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="p-4 bg-slate-800 rounded border border-yellow-500/30">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <h3 className="font-semibold text-slate-200">
              Wallet Permissions Request
            </h3>
          </div>
          <p className="text-sm text-slate-300">
            This application is requesting the following permissions:
          </p>
        </div>

        <div className="space-y-2 mb-4">
          {permissions.slice(0, expanded ? undefined : 2).map((permission) => (
            <div
              key={permission.id}
              className="p-3 bg-slate-700/50 rounded border border-slate-600"
            >
              <div className="flex items-start gap-2 mb-1">
                <span className={`text-sm font-semibold ${getRiskColor(permission.riskLevel)}`}>
                  {permission.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${getRiskColor(permission.riskLevel)} bg-slate-700`}
                >
                  {permission.riskLevel.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-slate-400">{permission.description}</p>
            </div>
          ))}

          {permissions.length > 2 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-sm text-blue-400 hover:text-blue-300 py-2"
            >
              Show {permissions.length - 2} more permission(s)
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onApprove}
            disabled={isProcessing}
            variant="primary"
            size="sm"
          >
            {isProcessing ? "Connecting..." : "Approve & Connect"}
          </Button>
          <Button
            onClick={onReject}
            disabled={isProcessing}
            variant="secondary"
            size="sm"
          >
            Reject
          </Button>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Only approve permissions you understand and trust. You can revoke these
          permissions at any time in your wallet settings.
        </p>
      </div>
    </Card>
  );
};

export default WalletPermissionsPanel;
