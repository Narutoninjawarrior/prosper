import * as functions from 'firebase-functions';
import {
  validateBlueprint,
  WORKSHOP_CATALOG,
  WORKSHOP_CATALOG_VERSION,
  WORKSHOP_LIMITS,
  WORKSHOP_SCHEMA_VERSION,
  WorkshopMode,
} from './workshop';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function requestPath(req: functions.Request): string {
  return `${req.path || ''} ${req.originalUrl || ''}`;
}

export const workshopApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const path = requestPath(req);
  if (path.includes('/api/workshop/catalog')) {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed. Catalog is read-only GET.' });
      return;
    }
    if (!applyRateLimit(req, res, { bucket: 'workshop-catalog', windowMs: 60_000, max: 90 })) return;
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).json({
      schema_version: WORKSHOP_SCHEMA_VERSION,
      catalog_version: WORKSHOP_CATALOG_VERSION,
      limits: WORKSHOP_LIMITS,
      parts: WORKSHOP_CATALOG,
      policy: 'read-only',
    });
    return;
  }

  if (path.includes('/api/workshop/validate')) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Validate with POST; no state is mutated.' });
      return;
    }
    if (!applyRateLimit(req, res, { bucket: 'workshop-validate', windowMs: 60_000, max: 24 })) return;
    if (!applyBodyLimit(req, res, WORKSHOP_LIMITS.max_payload_bytes)) return;

    let body: unknown = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.status(400).json({ error: 'Request body is not valid JSON.' });
        return;
      }
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.status(400).json({ error: 'Expected JSON object { blueprint, mode? }.' });
      return;
    }

    const request = body as Record<string, unknown>;
    const mode: WorkshopMode = request.mode === 'preview' ? 'preview' : 'validation';
    res.set('Cache-Control', 'no-store');
    res.status(200).json(validateBlueprint(request.blueprint, mode));
    return;
  }

  res.status(404).json({ error: 'Unknown workshop route.' });
});
