// Developer/admin access, gated purely by email — a small, single-operator
// allowlist rather than a full role system. The client uses this only to
// decide whether to render the Developer section; every admin endpoint
// re-checks isAdmin(user.email) server-side, since a client-side check is
// UX, not a security boundary.

const ADMIN_EMAILS = new Set([
  'volcabaggy@gmail.com',
  'alycoulibal2@gmail.com',
  'alyc70755@gmail.com',
  'alycoulibal5@gmail.com',
]);

export function isAdmin(email) {
  return !!email && ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}
