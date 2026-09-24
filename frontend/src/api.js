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

// Sends the chat to Edith and calls onText(answerSoFar) each time more of the answer arrives.
// Returns the whole answer. The signal cancels the request (chat cleared or closed).
export async function streamChat(messages, onText, signal) {
  const response = await request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let answer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    answer += decoder.decode(value, { stream: true });
    onText(answer);
  }
  return answer.trim();
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
export const retryAi = (id) => apiFetch(`/tests/${id}/retry-ai`, { method: 'POST' });
export const captureCurrent = (id, currentUrl) =>
  apiFetch(`/tests/${id}/capture-current`, { method: 'POST', body: JSON.stringify({ currentUrl }) });

// Older, saved comparisons of a test
export const listComparisons = (testId) => apiFetch(`/tests/${testId}/comparisons`);
export const getComparison = (id) => apiFetch(`/comparisons/${id}`);
