import { supabase } from './supabaseClient.js';

// The signed-in user's token, sent with every API call
async function authHeaders() {
  const headers = {};
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  }
  return headers;
}

async function request(path, options) {
  try {
    return await fetch(`/api${path}`, options);
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
}

// Calls the Express API and returns the JSON answer.
export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()), ...options.headers };
  const response = await request(path, { ...options, headers });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

// Downloads a PDF from the API. A plain link cannot send the token, so we fetch it and save the Blob.
export async function downloadPdf(path) {
  const response = await request(path, { headers: await authHeaders() });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'visuguard-report.pdf';
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Test management calls
export const listTests = () => apiFetch('/tests');
export const getTest = (id) => apiFetch(`/tests/${id}`);
export const createTest = (baselineUrl) =>
  apiFetch('/tests', { method: 'POST', body: JSON.stringify({ baselineUrl }) });
export const deleteTest = (id) => apiFetch(`/tests/${id}`, { method: 'DELETE' });
export const captureBaseline = (id) => apiFetch(`/tests/${id}/capture-baseline`, { method: 'POST' });
export const analyzeTest = (id) => apiFetch(`/tests/${id}/analyze`, { method: 'POST' });
export const captureCurrent = (id, currentUrl) =>
  apiFetch(`/tests/${id}/capture-current`, { method: 'POST', body: JSON.stringify({ currentUrl }) });

// Older, saved comparisons of a test
export const listComparisons = (testId) => apiFetch(`/tests/${testId}/comparisons`);
export const getComparison = (id) => apiFetch(`/comparisons/${id}`);
