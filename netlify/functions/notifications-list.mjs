import * as notifications from './_lib/notifications.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => Response.json(await notifications.list(user.id)));

export const config = { path: '/api/notifications' };
