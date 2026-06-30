/**
 * Set steward custom claims on a Firebase Auth user (one-time steward setup).
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\Hearth\prosper2\secrets\firebase-service-account.json"
 *   node scripts/set-steward-claims.mjs cottagecommongoods@gmail.com
 *
 * Or with Application Default Credentials after: gcloud auth application-default login
 */
import admin from 'firebase-admin';

const email = process.argv[2]?.trim();
if (!email) {
  console.error('Usage: node scripts/set-steward-claims.mjs <email>');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'fellowship-of-the-hearth',
  });
}

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, { admin: true, sovereign: true });
console.log(`Set admin+sovereign claims on ${email} (uid=${user.uid})`);
console.log('User must sign out and sign in again for claims to appear in client tokens.');
