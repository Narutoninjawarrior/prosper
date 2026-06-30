/**
 * Create steward Firebase Auth user + admin/sovereign claims.
 * Requires Email/Password provider enabled in Firebase Console.
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\Hearth\prosper2\secrets\firebase-service-account.json"
 *   $env:STEWARD_EMAIL="cottagecommongoods@gmail.com"
 *   $env:STEWARD_BOOT_PASSWORD="choose-a-strong-password"
 *   node scripts/create-steward-user.mjs
 */
import admin from 'firebase-admin';

const email = process.env.STEWARD_EMAIL?.trim();
const password = process.env.STEWARD_BOOT_PASSWORD?.trim();

if (!email || !password) {
  console.error('Set STEWARD_EMAIL and STEWARD_BOOT_PASSWORD env vars.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'fellowship-of-the-hearth',
  });
}

let user;
try {
  user = await admin.auth().getUserByEmail(email);
  console.log(`User already exists: ${email} (uid=${user.uid})`);
} catch (err) {
  if (err?.code !== 'auth/user-not-found') throw err;
  user = await admin.auth().createUser({
    email,
    emailVerified: true,
    password,
  });
  console.log(`Created user: ${email} (uid=${user.uid})`);
}

await admin.auth().setCustomUserClaims(user.uid, { admin: true, sovereign: true });
console.log('Claims set: { admin: true, sovereign: true }');
console.log('Sign in at Hearth OS gate with this email + STEWARD_BOOT_PASSWORD.');
