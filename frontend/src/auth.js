import { supabase } from './supabaseClient.js';

// Thin wrappers around Supabase Auth. Supabase does the real work.
// Each function throws the Supabase error so the UI can show a message.

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// callback(event, session) runs on sign in, sign out, password recovery, etc.
// Returns a function that stops listening.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInWithGoogle() {
  // Get the Google URL first instead of redirecting straight away
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin, skipBrowserRedirect: true },
  });
  if (error) throw error;

  // If Google is not enabled in the Supabase dashboard, Supabase answers 400.
  // Catch it here so the user sees a message and not a raw JSON page.
  const check = await fetch(data.url, { redirect: 'manual' }).catch(() => null);
  if (check && check.status === 400) throw new Error('provider is not enabled');

  window.location.assign(data.url);
}

// Sends the reset email. The link brings the user back to this app.
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

// Used after the user opens the reset link and picks a new password.
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Turns Supabase's technical messages into short messages for the user.
const friendlyMessages = [
  ['invalid login credentials', 'Invalid email or password.'],
  ['email not confirmed', 'Please confirm your email before signing in.'],
  ['already registered', 'An account with this email already exists.'],
  ['rate limit', 'Too many attempts. Please wait a minute and try again.'],
  ['password should be', 'Password must be at least 6 characters.'],
  ['same password', 'Choose a password different from your old one.'],
  ['provider is not enabled', 'Google sign-in is not enabled for this project yet.'],
];

export function friendlyAuthError(error, fallback) {
  const text = (error?.message || '').toLowerCase();
  const match = friendlyMessages.find(([needle]) => text.includes(needle));
  return match ? match[1] : fallback;
}
