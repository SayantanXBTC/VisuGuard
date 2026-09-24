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
  // Supabase redirects the browser itself (one navigation, no extra round trip). An earlier
  // version pre-checked the OAuth URL with a manual fetch to show a friendlier error when the
  // provider was disabled, but that meant hitting Google's authorize endpoint twice per click -
  // once from the check, once for the real navigation - which is fragile with an active Google
  // session (instant SSO can complete the first, abandoned request before the second even lands).
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
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
