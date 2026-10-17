# Query Invalidation Strategy for Frontend

## Overview

This document defines the query invalidation strategy for the prompt-mint frontend application. Proper query invalidation ensures data consistency, prevents stale data display, and optimizes cache performance.

## Core Principles

1. **Invalidate on mutation**: Always invalidate related queries after successful mutations
2. **Granular invalidation**: Invalidate only affected queries to minimize unnecessary refetches
3. **Optimistic updates**: Use optimistic updates where appropriate for better UX
4. **Background refetch**: Leverage stale-while-revalidate for non-critical data

## Technology Stack

- **React Query (TanStack Query)**: Primary data fetching and caching library
- **Query Keys**: Hierarchical structure for precise cache management

## Query Key Structure

```typescript
// User queries
['user', userId]
['user', 'profile', userId]
['user', 'wallet', walletAddress]

// Payout queries
['payouts', 'list', filters]
['payouts', 'detail', payoutId]
['payouts', 'history', userId]

// Transaction queries
['transactions', 'pending']
['transactions', 'history', walletAddress]
['transactions', 'detail', txHash]

// Wallet queries
['wallet', 'balance', walletAddress]
['wallet', 'requests']
['wallet', 'connection']
```

## Invalidation Patterns

### 1. Wallet Connection/Disconnection

When wallet connects or disconnects:

```typescript
// Invalidate all wallet-related queries
await queryClient.invalidateQueries({ queryKey: ['wallet'] });
await queryClient.invalidateQueries({ queryKey: ['user'] });
await queryClient.invalidateQueries({ queryKey: ['transactions'] });
```

### 2. Payout Creation

After creating a new payout:

```typescript
// Invalidate payout list and user balance
await queryClient.invalidateQueries({ queryKey: ['payouts', 'list'] });
await queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
await queryClient.invalidateQueries({ queryKey: ['payouts', 'history'] });
```

### 3. Payout Retry (Issue #681)

After retrying a failed payout:

```typescript
// Invalidate specific payout and related queries
await queryClient.invalidateQueries({ queryKey: ['payouts', 'detail', payoutId] });
await queryClient.invalidateQueries({ queryKey: ['payouts', 'history'] });
await queryClient.invalidateQueries({ queryKey: ['transactions', 'pending'] });
```

### 4. Wallet Account Switch (Issue #683)

After switching wallet accounts:

```typescript
// Remove all cached data and refetch with new account
await queryClient.resetQueries({ queryKey: ['wallet'] });
await queryClient.resetQueries({ queryKey: ['transactions'] });
await queryClient.resetQueries({ queryKey: ['payouts'] });

// Immediately refetch critical data
await queryClient.refetchQueries({ queryKey: ['wallet', 'balance'] });
await queryClient.refetchQueries({ queryKey: ['wallet', 'connection'] });
```

### 5. Wallet Request Cleanup (Issue #682)

After cleaning up stale requests:

```typescript
// Invalidate only the wallet requests query
await queryClient.invalidateQueries({ queryKey: ['wallet', 'requests'] });
```

### 6. Transaction Completion

When a transaction is confirmed on-chain:

```typescript
// Invalidate transaction and related balance queries
await queryClient.invalidateQueries({ queryKey: ['transactions', 'detail', txHash] });
await queryClient.invalidateQueries({ queryKey: ['transactions', 'history'] });
await queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
```

## Optimistic Updates

Use optimistic updates for operations with high success rates:

```typescript
// Example: Optimistic payout retry
const mutation = useMutation({
  mutationFn: retryPayout,
  onMutate: async (payoutId) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['payouts', 'detail', payoutId] });
    
    // Snapshot previous value
    const previousPayout = queryClient.getQueryData(['payouts', 'detail', payoutId]);
    
    // Optimistically update
    queryClient.setQueryData(['payouts', 'detail', payoutId], (old) => ({
      ...old,
      status: 'retrying',
      retryCount: old.retryCount + 1,
    }));
    
    return { previousPayout };
  },
  onError: (err, payoutId, context) => {
    // Rollback on error
    queryClient.setQueryData(['payouts', 'detail', payoutId], context.previousPayout);
  },
  onSettled: (payoutId) => {
    // Always refetch after mutation
    queryClient.invalidateQueries({ queryKey: ['payouts', 'detail', payoutId] });
  },
});
```

## Stale Time Configuration

Configure appropriate stale times based on data volatility:

```typescript
const queryConfig = {
  // Frequently changing data
  walletBalance: { staleTime: 30 * 1000 }, // 30 seconds
  pendingTransactions: { staleTime: 10 * 1000 }, // 10 seconds
  
  // Moderately stable data
  payoutHistory: { staleTime: 5 * 60 * 1000 }, // 5 minutes
  userProfile: { staleTime: 10 * 60 * 1000 }, // 10 minutes
  
  // Rarely changing data
  supportedTokens: { staleTime: 60 * 60 * 1000 }, // 1 hour
  networkConfig: { staleTime: Infinity }, // Until manually invalidated
};
```

## Background Refetch

Enable background refetch for critical real-time data:

```typescript
useQuery({
  queryKey: ['wallet', 'balance', address],
  queryFn: fetchBalance,
  refetchInterval: 30000, // Refetch every 30 seconds
  refetchIntervalInBackground: true, // Continue refetching when tab is inactive
});
```

## Error Handling

Handle invalidation failures gracefully:

```typescript
try {
  await queryClient.invalidateQueries({ queryKey: ['payouts'] });
} catch (error) {
  console.error('Failed to invalidate queries:', error);
  // Fallback: force refetch on next user interaction
  queryClient.setQueryDefaults(['payouts'], {
    staleTime: 0,
  });
}
```

## Testing Strategy

1. **Unit tests**: Verify invalidation logic in mutation callbacks
2. **Integration tests**: Ensure correct queries are invalidated after operations
3. **E2E tests**: Validate UI reflects latest data after mutations

```typescript
// Example test
it('should invalidate payout queries after retry', async () => {
  const { result } = renderHook(() => useRetryPayout());
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  
  await act(async () => {
    await result.current.mutateAsync('payout-123');
  });
  
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['payouts', 'detail', 'payout-123'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['payouts', 'history'] });
});
```

## Best Practices

1. **Avoid over-invalidation**: Don't invalidate entire query trees if only a subset changed
2. **Use exact matching**: Prefer `{ queryKey: ['payouts', 'detail', id], exact: true }` when possible
3. **Document invalidation**: Add comments explaining why specific queries are invalidated
4. **Monitor performance**: Use React Query DevTools to identify unnecessary refetches
5. **Batch invalidations**: Group related invalidations in a single async block

## Common Pitfalls

❌ **Don't**: Invalidate on every render
```typescript
// Bad
useEffect(() => {
  queryClient.invalidateQueries({ queryKey: ['payouts'] });
}, [someValue]);
```

✅ **Do**: Invalidate only after mutations
```typescript
// Good
const mutation = useMutation({
  mutationFn: updatePayout,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['payouts'] });
  },
});
```

## Migration Checklist

When adding new queries or mutations:

- [ ] Define clear query key structure
- [ ] Configure appropriate stale time
- [ ] Implement invalidation in mutation callbacks
- [ ] Consider optimistic updates for better UX
- [ ] Add tests for invalidation logic
- [ ] Document invalidation strategy

## References

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Query Invalidation Guide](https://tanstack.com/query/latest/docs/react/guides/query-invalidation)
- [Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)

## Changelog

- **2024-10-17**: Initial query invalidation strategy document (Issue #690)
