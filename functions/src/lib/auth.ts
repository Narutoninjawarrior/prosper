import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export interface AuthContext {
  uid: string;
  claims: admin.auth.DecodedIdToken;
}

function adminUidSet(): Set<string> {
  const uids = new Set<string>();
  const sovereign = process.env.SOVEREIGN_UID?.trim();
  if (sovereign) uids.add(sovereign);
  const list = process.env.SOVEREIGN_ADMIN_UIDS || '';
  for (const entry of list.split(',')) {
    const uid = entry.trim();
    if (uid) uids.add(uid);
  }
  return uids;
}

export async function verifyAuthToken(req: functions.Request): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;
  try {
    const claims = await admin.auth().verifyIdToken(idToken);
    return { uid: claims.uid, claims };
  } catch {
    return null;
  }
}

export function isAdmin(ctx: AuthContext): boolean {
  if (ctx.claims.admin === true || ctx.claims.sovereign === true) return true;
  return adminUidSet().has(ctx.uid);
}

export async function requireAuth(
  req: functions.Request,
  res: functions.Response
): Promise<AuthContext | null> {
  const ctx = await verifyAuthToken(req);
  if (!ctx) {
    res.status(401).json({ error: 'unauthenticated' });
    return null;
  }
  return ctx;
}

export async function requireAdmin(
  req: functions.Request,
  res: functions.Response
): Promise<AuthContext | null> {
  const ctx = await requireAuth(req, res);
  if (!ctx) return null;
  if (!isAdmin(ctx)) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }
  return ctx;
}

/** Returns verified uid or null. Prefer requireAuth for endpoints that should reject callers. */
export async function verifyAuth(req: functions.Request): Promise<string | null> {
  const ctx = await verifyAuthToken(req);
  return ctx?.uid ?? null;
}
