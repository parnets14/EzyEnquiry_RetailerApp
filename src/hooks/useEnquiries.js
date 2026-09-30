// src/hooks/useEnquiries.js
//
// Mirrors wholesalerapp/src/hooks/useEnquiries.js.
//
// DELTA: the retailer's list endpoint returns `{ enquiries, ... }` rather than a
// bare array, so both shapes are accepted. The unread counter uses this app's
// own "new" status (`'New'`), matching the pills on EnquiriesScreen.
import { useCallback, useEffect, useState } from 'react';
import { enquiryService } from '../services/enquiryService';

export default function useEnquiries(status) {
  const [enquiries,   setEnquiries]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await enquiryService.list(status ? { status, limit: 100 } : { limit: 100 });
      const list = Array.isArray(res) ? res : (res?.enquiries ?? []);
      setEnquiries(list);
      // Only meaningful on the unfiltered list — a status-filtered fetch would
      // count 0 and flash the badge off.
      if (!status) {
        setUnreadCount(list.filter(e => e.status === 'New').length);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return { enquiries, loading, error, refetch: load, unreadCount };
}
