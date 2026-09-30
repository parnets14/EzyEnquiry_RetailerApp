// src/hooks/useAuth.js
//
// The hook itself is defined beside the provider (context/AuthContext.jsx) so
// the context object stays private to that module. It is re-exported here so the
// import path matches the wholesaler app's `hooks/useAuth`.
export { useAuth, useAuth as default } from '../context/AuthContext';
