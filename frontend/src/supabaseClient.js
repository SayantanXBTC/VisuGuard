import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null until the keys are added to frontend/.env, so the app still starts without them
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
