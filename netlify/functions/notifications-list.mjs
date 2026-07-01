import * as notifications from './_lib/notifications.mjs';

export default async () => Response.json(await notifications.list());

export const config = { path: '/api/notifications' };
