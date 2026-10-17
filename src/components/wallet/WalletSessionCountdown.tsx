import React, { useState, useEffect } from "react";

interface WalletSessionCountdownProps {
  expiryTime?: Date;
  warningThresholdMinutes?: number;
  onWarning?: () => void;
  onExpired?: () => void;
}

const WalletSessionCountdown: React.FC<WalletSessionCountdownProps> = ({
  expiryTime,
  warningThresholdMinutes = 5,
  onWarning,
  onExpired,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiryTime) {
      setTimeRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = expiryTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        setIsExpired(true);
        onExpired?.();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const warningThresholdMs = warningThresholdMinutes * 60000;
      const shouldWarn = diff <= warningThresholdMs && diff > 0;

      if (shouldWarn && !isWarning) {
        setIsWarning(true);
        onWarning?.();
      } else if (!shouldWarn && isWarning) {
        setIsWarning(false);
      }

      setTimeRemaining(`${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [expiryTime, warningThresholdMinutes, onWarning, onExpired, isWarning]);

  if (!timeRemaining) {
    return null;
  }

  const bgColor = isExpired
    ? "bg-red-500/10 border-red-500/30"
    : isWarning
      ? "bg-yellow-500/10 border-yellow-500/30"
      : "bg-slate-700 border-slate-600";

  const textColor = isExpired
    ? "text-red-400"
    : isWarning
      ? "text-yellow-400"
      : "text-slate-300";

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${bgColor} text-xs font-mono`}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      <span className={textColor}>
        Session: <strong>{timeRemaining}</strong>
      </span>
    </div>
  );
};

export default WalletSessionCountdown;
