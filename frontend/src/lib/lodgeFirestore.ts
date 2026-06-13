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

export type LodgeMetaDoc = {
  id: string;
  label: string;
  manifest_hash?: string;
  updated_at?: string;
  seed_source?: string;
  seed_sync_bundle_generated_at?: string;
};

export type LiveFetchOk<T> = { ok: true; rows: T[] };
export type LiveFetchErr = { ok: false; reason: 'no_db' | 'failed' };
export type LiveFetchResult<T> = LiveFetchOk<T> | LiveFetchErr;

export type LodgeClaimRow = {
  id: string;
  handle: string;
  profile_url?: string;
  note?: string;
  status?: string;
  created_at?: string;
  reviewed_at?: string;
};

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readTimestampish(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      try {
        const date = (value as { toDate: () => Date }).toDate();
        return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
      } catch {
        return undefined;
      }
    }

    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }

  return undefined;
}

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
        status: typeof d.status === 'string' ? d.status : undefined,
        created_at: readTimestampish(d.created_at),
        reviewed_at: readTimestampish(d.reviewed_at),
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

export async function fetchLiveMetaPreview(max = 8): Promise<LiveFetchResult<LodgeMetaDoc>> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, reason: 'no_db' };

  try {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.meta), limit(max));
    const snap = await getDocs(q);
    const rows: LodgeMetaDoc[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      rows.push({
        id: docSnap.id,
        label: readOptionalString(d.title) ?? readOptionalString(d.name) ?? docSnap.id,
        manifest_hash: readOptionalString(d.manifest_hash),
        updated_at: readOptionalString(d.updated_at),
        seed_source: readOptionalString(d.seed_source),
        seed_sync_bundle_generated_at: readOptionalString(d.seed_sync_bundle_generated_at),
      });
    });

    return { ok: true, rows };
  } catch (error) {
    console.error('[lodgeFirestore] fetchLiveMetaPreview failed', error);
    return { ok: false, reason: 'failed' };
  }
}
