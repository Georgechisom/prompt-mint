import React from "react";
import { Card } from "@stellar/design-system";

interface WalletFeature {
  name: string;
  supported: boolean;
  description?: string;
}

interface WalletCompatibilityChecklistProps {
  walletName?: string;
  features?: WalletFeature[];
}

const defaultFeatures: WalletFeature[] = [
  { name: "Transaction Signing", supported: true },
  { name: "Contract Invocation", supported: true },
  { name: "Multi-sig Support", supported: false },
  { name: "Soroban Integration", supported: true },
  { name: "Hardware Wallet", supported: false },
  { name: "Mobile Support", supported: true },
];

const WalletCompatibilityChecklist: React.FC<
  WalletCompatibilityChecklistProps
> = ({ walletName = "Current Wallet", features = defaultFeatures }) => {
  const supportedCount = features.filter((f) => f.supported).length;
  const totalCount = features.length;
  const supportPercentage = Math.round((supportedCount / totalCount) * 100);

  return (
    <Card>
      <div className="p-4 bg-slate-800 rounded border border-slate-700">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">
            {walletName} Compatibility
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${supportPercentage}%` }}
              />
            </div>
            <span className="text-sm font-mono text-slate-300">
              {supportPercentage}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="flex items-start gap-3 text-sm py-2 px-2 rounded hover:bg-slate-700/50 transition-colors"
            >
              <span
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                  feature.supported
                    ? "bg-emerald-500/20 border-emerald-500"
                    : "bg-slate-700 border-slate-600"
                }`}
              >
                {feature.supported && (
                  <span className="text-emerald-400 text-xs font-bold">✓</span>
                )}
              </span>
              <div className="flex-1">
                <p
                  className={
                    feature.supported ? "text-slate-200" : "text-slate-400"
                  }
                >
                  {feature.name}
                </p>
                {feature.description && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {feature.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default WalletCompatibilityChecklist;
