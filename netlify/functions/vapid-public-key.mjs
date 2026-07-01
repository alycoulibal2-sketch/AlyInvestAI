export default async () => Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY });

export const config = { path: '/api/vapid-public-key' };
