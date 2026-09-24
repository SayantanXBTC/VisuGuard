import { supabase } from './supabaseClient.js';

// Calls the Express API. Adds the signed-in user's token when there is one.
export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  }

  let response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

// Test management calls
export const listTests = () => apiFetch('/tests');
export const getTest = (id) => apiFetch(`/tests/${id}`);
export const createTest = (baselineUrl) =>
  apiFetch('/tests', { method: 'POST', body: JSON.stringify({ baselineUrl }) });
export const deleteTest = (id) => apiFetch(`/tests/${id}`, { method: 'DELETE' });
export const captureBaseline = (id) => apiFetch(`/tests/${id}/capture-baseline`, { method: 'POST' });
export const captureCurrent = (id, currentUrl) =>
  apiFetch(`/tests/${id}/capture-current`, { method: 'POST', body: JSON.stringify({ currentUrl }) });
