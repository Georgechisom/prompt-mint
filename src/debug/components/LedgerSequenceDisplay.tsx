import React, { useState, useEffect } from "react";
import { Card } from "@stellar/design-system";

interface LedgerSequenceDisplayProps {
  ledgerSequence?: number;
  isLoading?: boolean;
}

const LedgerSequenceDisplay: React.FC<LedgerSequenceDisplayProps> = ({
  ledgerSequence,
  isLoading = false,
}) => {
  const [displaySequence, setDisplaySequence] = useState<number | null>(null);

  useEffect(() => {
    if (ledgerSequence !== undefined) {
      setDisplaySequence(ledgerSequence);
    }
  }, [ledgerSequence]);

  if (isLoading) {
    return (
      <Card>
        <div className="p-4 bg-slate-800 rounded border border-slate-700">
          <p className="text-sm text-slate-400">Loading ledger sequence...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-4 bg-slate-800 rounded border border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">
            Ledger Sequence
          </span>
          <span className="text-lg font-mono font-bold text-emerald-400">
            {displaySequence !== null ? `#${displaySequence}` : "N/A"}
          </span>
        </div>
        {displaySequence !== null && (
          <p className="text-xs text-slate-400 mt-2">
            Current ledger sequence number for this transaction
          </p>
        )}
      </div>
    </Card>
  );
};

export default LedgerSequenceDisplay;
