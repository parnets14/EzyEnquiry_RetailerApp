// src/hooks/useOrders.js
//
// Mirrors wholesalerapp/src/hooks/useOrders.js.
//
// DELTA: the retailer's list endpoint returns `{ orders, ... }` rather than a
// bare array, so both shapes are accepted.
import { useCallback, useEffect, useState } from 'react';
import { orderService } from '../services/orderService';

export default function useOrders(status) {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orderService.list(status ? { status, limit: 100 } : { limit: 100 });
      const list = Array.isArray(res) ? res : (res?.orders ?? []);
      setOrders(list);
    } catch (err) {
      setError(err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return { orders, loading, error, refetch: load };
}
