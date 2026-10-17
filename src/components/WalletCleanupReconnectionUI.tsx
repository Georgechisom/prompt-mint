// Issue #682: Add a wallet request cleanup and reconnection helper UI
// Provides UI to clean up stale wallet requests and reconnect

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Loader2, Trash2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export interface WalletRequest {
  id: string;
  type: 'transaction' | 'signature' | 'connection';
  timestamp: string;
  status: 'pending' | 'stale' | 'failed';
}

interface WalletCleanupReconnectionUIProps {
  requests: WalletRequest[];
  onCleanup: () => Promise<void>;
  onReconnect: () => Promise<void>;
  isConnected: boolean;
}

export const WalletCleanupReconnectionUI: React.FC<WalletCleanupReconnectionUIProps> = ({
  requests,
  onCleanup,
  onReconnect,
  isConnected,
}) => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [reconnectStatus, setReconnectStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const staleRequests = requests.filter(r => r.status === 'stale' || r.status === 'failed');
  const hasStaleRequests = staleRequests.length > 0;

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    setCleanupStatus('idle');
    setErrorMessage('');

    try {
      await onCleanup();
      setCleanupStatus('success');
      setTimeout(() => setCleanupStatus('idle'), 3000);
    } catch (error) {
      setCleanupStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to cleanup requests'
      );
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectStatus('idle');
    setErrorMessage('');

    try {
      await onReconnect();
      setReconnectStatus('success');
      setTimeout(() => setReconnectStatus('idle'), 3000);
    } catch (error) {
      setReconnectStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to reconnect wallet'
      );
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Wallet Connection Manager</CardTitle>
        <CardDescription>
          Clean up stale requests and reconnect your wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
          <span className="text-sm font-medium">Connection Status</span>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Stale Requests Summary */}
        {hasStaleRequests && (
          <Alert variant="destructive">
            <AlertDescription>
              You have {staleRequests.length} stale or failed wallet request{staleRequests.length > 1 ? 's' : ''}.
              Clean them up to improve performance.
            </AlertDescription>
          </Alert>
        )}

        {/* Request List */}
        {requests.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Pending Requests</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={`p-3 rounded-md border text-sm ${
                    request.status === 'stale' || request.status === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium capitalize">{request.type}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      request.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                      request.status === 'stale' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(request.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {requests.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No pending wallet requests
          </div>
        )}

        {/* Status Messages */}
        {cleanupStatus === 'success' && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Successfully cleaned up stale requests
            </AlertDescription>
          </Alert>
        )}

        {reconnectStatus === 'success' && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Successfully reconnected to wallet
            </AlertDescription>
          </Alert>
        )}

        {(cleanupStatus === 'error' || reconnectStatus === 'error') && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleCleanup}
            disabled={!hasStaleRequests || isCleaningUp || isReconnecting}
            variant="destructive"
            className="flex-1"
          >
            {isCleaningUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clean Up
              </>
            )}
          </Button>
          <Button
            onClick={handleReconnect}
            disabled={isConnected || isCleaningUp || isReconnecting}
            className="flex-1"
          >
            {isReconnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reconnecting...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconnect
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
