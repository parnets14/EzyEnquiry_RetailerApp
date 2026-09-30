// src/hooks/usePermissions.js
//
// Returns { role, can(moduleKey) } for gating UI by the signed-in account's
// module access. Mirrors wholesalerapp/src/hooks/usePermissions.js.
//
// DELTA: the wholesaler gates on ROLE. The Retailer app has two kinds of account
// — the retailer owner (full access) and RetailerStaff, limited to the modules
// the owner ticked — so the check reads the user object, not a role table. See
// utils/moduleAccess.js; an unknown/owner account gets full access, which keeps
// this non-breaking.
import useAuth from './useAuth';
import { canAccess } from '../utils/moduleAccess';

export default function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || null;
  return {
    role,
    can: (moduleKey) => canAccess(user, moduleKey),
  };
}
