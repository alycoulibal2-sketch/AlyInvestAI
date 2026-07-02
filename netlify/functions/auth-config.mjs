// Public, safe to expose — the anon key is Supabase's public client key,
// meant to ship in frontend code (it has no privileged access on its own).
export default async () => Response.json({
  supabaseUrl: process.env.SUPABASE_URL || null,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
});

export const config = { path: '/api/auth-config' };
