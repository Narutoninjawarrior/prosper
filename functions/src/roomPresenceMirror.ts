import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

type RtdbPresenceValue = {
  uid?: unknown;
  display_name?: unknown;
  state?: unknown;
  status?: unknown;
  last_changed?: unknown;
  last_active_ms?: unknown;
};

function normalizePresenceState(value: unknown): 'online' | 'offline' {
  return value === 'online' ? 'online' : 'offline';
}

function normalizeMillis(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

export const mirrorProjectRoomPresence = functions.database
  .ref('/project_room_presence/{roomId}/{uid}')
  .onWrite(async (change, context) => {
    const roomId = String(context.params.roomId || '');
    const uid = String(context.params.uid || '');
    if (!roomId || !uid) return null;

    const memberRef = db.collection('project_rooms').doc(roomId).collection('members').doc(uid);
    const memberSnapshot = await memberRef.get();
    const presenceRef = db.collection('project_rooms').doc(roomId).collection('presence').doc(uid);

    if (!memberSnapshot.exists) {
      await presenceRef.delete().catch(() => undefined);
      functions.logger.warn('presence_mirror_rejected_non_member', { roomId, uid });
      return null;
    }

    if (!change.after.exists()) {
      await presenceRef.set(
        {
          uid,
          status: 'offline',
          last_active_ms: Date.now(),
          source: 'rtdb_on_disconnect',
          mirrored_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return null;
    }

    const value = change.after.val() as RtdbPresenceValue;
    const member = memberSnapshot.data() || {};
    const displayName =
      typeof value.display_name === 'string' && value.display_name.trim()
        ? value.display_name.trim()
        : typeof member.display_name === 'string' && member.display_name.trim()
          ? member.display_name.trim()
          : typeof member.email === 'string' && member.email.trim()
            ? member.email.trim()
            : uid;

    await presenceRef.set(
      {
        uid,
        display_name: displayName,
        status: normalizePresenceState(value.state || value.status),
        last_active_ms: normalizeMillis(value.last_changed || value.last_active_ms),
        source: 'rtdb_on_disconnect',
        mirrored_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return null;
  });
