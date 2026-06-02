admin.firestore().collection('agent_profiles').doc('malaky').set({ember_balance: 1000}, {merge:true}).then(() => process.exit(0));
