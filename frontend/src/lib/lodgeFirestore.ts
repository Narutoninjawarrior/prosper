import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirestoreDb } from '../firebaseConfig';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export type LodgeLiveMemberDoc = {
  id: string;
  handle: string;
  room?: string;
  access_level?: string;
  moltbook_profile_url?: string;
};

export type LodgeLiveRoomDoc = {
  id: string;
  name: string;
  owner?: string;
  visibility?: string;
};

export type LodgeLiveQuestDoc = {
  id: string;
  title: string;
  status?: string;
  room?: string;
};

export type LiveFetchOk<T> = { ok: true; rows: T[] };
export type LiveFetchErr = { ok: false; reason: 'no_db' | 'failed' };
export type LiveFetchResult<T> = LiveFetchOk<T> | LiveFetchErr;

export type LodgeClaimRow = {
  id: string;
  handle: string;
  profile_url?: string;
  note?: string;
};

export async function fetchLiveMembersPreview(max = 40): Promise<LiveFetchResult<LodgeLiveMemberDoc>> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, reason: 'no_db' };

  try {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.members), limit(max));
    const snap = await getDocs(q);
    const rows: LodgeLiveMemberDoc[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const handle = typeof d.handle === 'string' ? d.handle.trim() : '';
      if (!handle) return;

      let moltbook_profile_url: string | undefined;
      if (typeof d.moltbook_profile_url === 'string' && isHttpsUrl(d.moltbook_profile_url)) {
        moltbook_profile_url = d.moltbook_profile_url;
      }

      rows.push({
        id: docSnap.id,
        handle,
        room: typeof d.room === 'string' ? d.room : undefined,
        access_level: typeof d.access_level === 'string' ? d.access_level : undefined,
        moltbook_profile_url,
      });
    });

    return { ok: true, rows };
  } catch (error) {
    console.error('[lodgeFirestore] fetchLiveMembersPreview failed', error);
    return { ok: false, reason: 'failed' };
  }
}

export async function fetchLiveRoomsPreview(max = 40): Promise<LiveFetchResult<LodgeLiveRoomDoc>> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, reason: 'no_db' };

  try {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.rooms), limit(max));
    const snap = await getDocs(q);
    const rows: LodgeLiveRoomDoc[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const name = typeof d.name === 'string' ? d.name.trim() : '';
      if (!name) return;

      rows.push({
        id: docSnap.id,
        name,
        owner: typeof d.owner === 'string' ? d.owner : undefined,
        visibility: typeof d.visibility === 'string' ? d.visibility : undefined,
      });
    });

    return { ok: true, rows };
  } catch (error) {
    console.error('[lodgeFirestore] fetchLiveRoomsPreview failed', error);
    return { ok: false, reason: 'failed' };
  }
}

export async function fetchApprovedClaims(max = 12): Promise<LiveFetchResult<LodgeClaimRow>> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, reason: 'no_db' };

  try {
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.claims),
      where('status', '==', 'approved'),
      limit(max),
    );
    const snap = await getDocs(q);
    const rows: LodgeClaimRow[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const handle = typeof d.handle === 'string' ? d.handle.trim() : '';
      if (!handle) return;

      let profile_url: string | undefined;
      if (typeof d.profile_url === 'string' && isHttpsUrl(d.profile_url)) {
        profile_url = d.profile_url;
      }

      rows.push({
        id: docSnap.id,
        handle,
        profile_url,
        note: typeof d.note === 'string' ? d.note : undefined,
      });
    });

    return { ok: true, rows };
  } catch (error) {
    console.error('[lodgeFirestore] fetchApprovedClaims failed', error);
    return { ok: false, reason: 'failed' };
  }
}

export async function fetchLiveQuestsPreview(max = 40): Promise<LiveFetchResult<LodgeLiveQuestDoc>> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, reason: 'no_db' };

  try {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.quests), limit(max));
    const snap = await getDocs(q);
    const rows: LodgeLiveQuestDoc[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const title = typeof d.title === 'string' ? d.title.trim() : '';
      if (!title) return;

      rows.push({
        id: docSnap.id,
        title,
        status: typeof d.status === 'string' ? d.status : undefined,
        room: typeof d.room === 'string' ? d.room : undefined,
      });
    });

    return { ok: true, rows };
  } catch (error) {
    console.error('[lodgeFirestore] fetchLiveQuestsPreview failed', error);
    return { ok: false, reason: 'failed' };
  }
}
