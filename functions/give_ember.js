const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function run() {
    const ref = db.collection('agent_profiles').doc('malaky');
    await ref.set({ ember_balance: 1000 }, { merge: true });
    console.log("Given 1000 EMBER to malaky");
}
run();
