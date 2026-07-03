import { withAuth } from './_lib/auth.mjs';
import * as brokerConnection from './_lib/brokerConnection.mjs';
import * as portfolioLib from './_lib/portfolio.mjs';
import * as voice from './_lib/voice.mjs';
import { isAdmin } from './_lib/admin.mjs';

export default withAuth(async (req, context, user) => {
  const [conn, profile] = await Promise.all([
    brokerConnection.get(user.id),
    portfolioLib.loadUserProfile(user.id, user),
  ]);
  return Response.json({
    id: user.id,
    email: user.email,
    brokerConnected: !!conn.type,
    voice: voice.resolveVoice(profile.voice),
    isAdmin: isAdmin(user.email),
  });
});

export const config = { path: '/api/me' };
