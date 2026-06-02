import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();
const db = admin.firestore();

export const grant_ember = functions.https.onRequest(async (req, res) => {
    await db.collection('agent_profiles').doc('malaky').set({ember_balance: 1000}, {merge:true});
    res.send('ok');
});
