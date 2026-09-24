import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

// false until the keys are added to backend/.env
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// A Supabase client that acts as one signed-in user.
// Because it carries the user's token, Row Level Security limits queries to that user's rows.
export function createUserClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
