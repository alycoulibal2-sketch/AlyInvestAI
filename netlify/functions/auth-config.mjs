// Public, safe to expose — Firebase's client config (including apiKey) is
// meant to ship in frontend code; it identifies the project, it doesn't
// grant privileged access on its own.
export default async () => Response.json({
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY || null,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    appId: process.env.FIREBASE_APP_ID || null,
  },
});

export const config = { path: '/api/auth-config' };
