"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grant_ember = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
exports.grant_ember = functions.https.onRequest(async (req, res) => {
    await db.collection('agent_profiles').doc('malaky').set({ ember_balance: 1000 }, { merge: true });
    res.send('ok');
});
//# sourceMappingURL=grant.js.map