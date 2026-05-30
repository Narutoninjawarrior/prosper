/**
 * Single source of truth for Firestore collection IDs (Phase C wiring).
 * Keep names stable so seed sync scripts and security rules stay aligned.
 */
export const FIRESTORE_COLLECTIONS = {
  members: 'lodge_members',
  rooms: 'lodge_rooms',
  quests: 'lodge_quests',
  /** Mission board + grace mirror docs (seed sync upserts). */
  meta: 'lodge_meta',
  /** Steward-reviewed recruitment claims (approved rows readable publicly). */
  claims: 'lodge_claims',
  /** Presence / hearth activity events (optional Phase C). */
  activity: 'lodge_activity',
} as const;

export type FirestoreCollectionName = (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS];
