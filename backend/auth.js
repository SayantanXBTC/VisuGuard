import { createUserClient, supabaseConfigured } from './supabase.js';

// Express middleware: checks the Supabase token sent by the frontend.
// On success it sets:
//   req.user  the signed-in user (from the verified token, never from the request body)
//   req.db    a Supabase client that acts as that user, so Row Level Security applies
export async function requireUser(req, res, next) {
  if (!supabaseConfigured) {
    return res.status(503).json({ error: 'The server is missing its Supabase keys.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Please sign in.' });
  }

  const db = createUserClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  req.user = data.user;
  req.db = db;
  next();
}
