// src/hooks/useFetch.js
//
// Generic data-loading hook. Mirrors wholesalerapp/src/hooks/useFetch.js.
//
// The Retailer app's api client already unwraps the `{ success, data }`
// envelope, so `result?.data ?? result` is belt-and-braces for the few
// endpoints that return a nested `data` key of their own.
import { useCallback, useEffect, useState } from 'react';

export default function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result?.data ?? result);
    } catch (err) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
