import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getClientIp } from './edgeGuard';

function appCheckEnforced(): boolean {
  return process.env.APP_CHECK_ENFORCE === 'true';
}

function readAppCheckToken(req: functions.Request): string {
  const raw = req.headers['x-firebase-appcheck'];
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw) && raw[0]) return raw[0].trim();
  return '';
}

import { HybridAuthContext } from './auth';

/** Optional App Check gate. Off until APP_CHECK_ENFORCE=true and web client sends tokens. */
export async function enforceAppCheck(
  req: functions.Request,
  res: functions.Response,
  route: string,
  authCtx?: HybridAuthContext
): Promise<boolean> {
  if (!appCheckEnforced()) return true;

  // Skip App Check if the request is in an authenticated agent lane (bots)
  if (authCtx?.type === 'agent') return true;

  // Skip enforcement for requests authenticated with service account credentials
  // These are server-to-server calls (Lodge Steward, G1 bridge using witness API key)
  const apiKey = req.headers['x-api-key'];
  if (apiKey) return true; // Witness API key flow — App Check not applicable

  const token = readAppCheckToken(req);
  if (!token) {
    functions.logger.warn('app_check_missing', { route, ip: getClientIp(req) });
    res.status(401).json({ error: 'app_check_required' });
    return false;
  }

  try {
    await admin.appCheck().verifyToken(token);
    return true;
  } catch (err) {
    functions.logger.warn('app_check_invalid', {
      route,
      ip: getClientIp(req),
      detail: err instanceof Error ? err.message : String(err),
    });
    res.status(401).json({ error: 'invalid_app_check' });
    return false;
  }
}
