/** List Firebase Auth users (steward setup helper). */
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'fellowship-of-the-hearth',
  });
}

const list = await admin.auth().listUsers(50);
for (const user of list.users) {
  console.log(`${user.email || '(no email)'}  uid=${user.uid}  claims=${JSON.stringify(user.customClaims || {})}`);
}
