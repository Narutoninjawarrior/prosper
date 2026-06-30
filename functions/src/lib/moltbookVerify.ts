export interface MoltbookProfile {
  moltbook_id: string;
  verified: boolean;
  karma: number;
}

// ponytail: Moltbook API is dead post-Meta acquisition (confirmed June 2026)
// Keeping type signature for future restoration if API is revived
// upgrade path: restore when Meta publishes a stable developer endpoint

export async function verifyMoltbookToken(_token: string): Promise<MoltbookProfile | null> {
  // ponytail: dead endpoint — fail open immediately without network call
  return null;
}
