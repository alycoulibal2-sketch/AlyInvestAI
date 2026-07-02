// Verifies a Supabase access token by asking Supabase's own /auth/v1/user
// endpoint whether it's valid — no JWT secret needs to live in this project,
// and it stays correct even if Supabase rotates their signing keys.

import * as userRegistry from './userRegistry.mjs';

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function verifyUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new AuthError('Not signed in.');

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new AuthError('Auth is not configured on the server.', 500);

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!res.ok) throw new AuthError('Session expired or invalid — please sign in again.');

  const user = await res.json();
  if (!user || !user.id) throw new AuthError('Session expired or invalid — please sign in again.');

  await userRegistry.register(user.id);
  return user;
}

// Wraps a Netlify Function handler so it only runs after a valid session is
// confirmed, and always returns a clean 401 JSON body on auth failure instead
// of leaking a stack trace.
export function withAuth(handler) {
  return async (req, context) => {
    try {
      const user = await verifyUser(req);
      return await handler(req, context, user);
    } catch (err) {
      if (err instanceof AuthError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      return Response.json({ error: err.message }, { status: 500 });
    }
  };
}
