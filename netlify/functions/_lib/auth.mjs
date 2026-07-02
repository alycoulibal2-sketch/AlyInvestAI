// Verifies a Firebase ID token by asking Firebase's own Identity Toolkit
// REST API whether it's valid — no firebase-admin SDK / service account
// private key needs to live in this project, and it stays correct even if
// Firebase rotates their signing keys.

import * as userRegistry from './userRegistry.mjs';

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function verifyUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) throw new AuthError('Not signed in.');

  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new AuthError('Auth is not configured on the server.', 500);

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new AuthError('Session expired or invalid — please sign in again.');

  const data = await res.json();
  const account = data.users?.[0];
  if (!account || !account.localId) throw new AuthError('Session expired or invalid — please sign in again.');

  const user = {
    id: account.localId,
    email: account.email,
    displayName: account.displayName,
  };

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
