// Issue #681: Add a payout failure retry flow
// Allows users to retry failed payouts with clear feedback

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export interface PayoutFailure {
  id: string;
  amount: string;
  recipient: string;
  failedAt: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
}

interface PayoutRetryFlowProps {
  failure: PayoutFailure;
  onRetry: (id: string) => Promise<void>;
  onCancel: () => void;
}

export const PayoutRetryFlow: React.FC<PayoutRetryFlowProps> = ({
  failure,
  onRetry,
  onCancel,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryStatus, setRetryStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const canRetry = failure.retryCount < failure.maxRetries;

  const handleRetry = async () => {
    if (!canRetry) return;

    setIsRetrying(true);
    setRetryStatus('idle');
    setErrorMessage('');

    try {
      await onRetry(failure.id);
      setRetryStatus('success');
    } catch (error) {
      setRetryStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to retry payout'
      );
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Payout Failed
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Retry attempt {failure.retryCount} of {failure.maxRetries}
          </p>
        </div>
        <AlertCircle className="h-5 w-5 text-red-500" />
      </div>

      {/* Payout Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount:</span>
          <span className="font-medium">{failure.amount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Recipient:</span>
          <span className="font-mono text-xs">{failure.recipient}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Failed at:</span>
          <span>{new Date(failure.failedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Error Message */}
      <Alert variant="destructive">
        <AlertDescription className="text-sm">
          {failure.errorMessage}
        </AlertDescription>
      </Alert>

      {/* Retry Status */}
      {retryStatus === 'success' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Payout retry successful! The transaction has been resubmitted.
          </AlertDescription>
        </Alert>
      )}

      {retryStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleRetry}
          disabled={!canRetry || isRetrying || retryStatus === 'success'}
          className="flex-1"
        >
          {isRetrying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Payout
            </>
          )}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={isRetrying}
        >
          Cancel
        </Button>
      </div>

      {/* Max Retries Warning */}
      {!canRetry && (
        <Alert>
          <AlertDescription className="text-sm">
            Maximum retry attempts reached. Please contact support for assistance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
