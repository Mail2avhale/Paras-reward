// Centralized API base URL helper.
// Single source of truth for all frontend API calls.
//
// Usage:
//   import { API } from "<relative>/lib/api";
//   axios.get(`${API}/users/${uid}`)
//
// For files that need the raw backend URL (without the `/api` prefix),
// import BACKEND_URL instead.

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export default API;
