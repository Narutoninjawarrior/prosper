/**
 * emergent-lock.mjs - read-only health probe for the Emergent preview vessel.
 *
 * Verifies whether the preview host is awake and whether the advertised
 * discovery/SSE endpoints are actually mounted.
 */

const DEFAULT_BASE = 'https://hearth-lodge.preview.emergentagent.com';
const FETCH_TIMEOUT_MS = Number(process.env.EMERGENT_LOCK_TIMEOUT_MS || 15000);

const args = process.argv.slice(2);
const baseUrl = (args[0] || DEFAULT_BASE).replace(/\/$/, '');

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`[emergent-lock] ${tag}: ${name}${suffix}`);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: options.accept || '*/*',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url, options = {}) {
  const res = await fetchWithTimeout(url, options);
  const text = await res.text();
  return { res, text };
}

async function probeRoot() {
  try {
    const { res, text } = await getText(`${baseUrl}/`);
    record('root.status', res.status === 200, `HTTP ${res.status}`);
    if (!res.ok) return;

    const hasPreviewIframe =
      text.includes('loading-preview') || text.includes('app.emergent.sh/loading-preview');
    const hasIframe = text.includes('<iframe');
    const hasAppShell =
      text.includes('<!DOCTYPE html') &&
      !hasPreviewIframe;
    record(
      'root.surface',
      (hasIframe && hasPreviewIframe) || hasAppShell,
      hasPreviewIframe ? 'preview wrapper detected' : 'awake app shell detected',
    );
  } catch (err) {
    record('root.fetch', false, err?.name === 'AbortError' ? 'timeout' : err.message);
  }
}

async function probeEndpoint(path, { accept = 'application/json', expect = 200 } = {}) {
  try {
    const url = `${baseUrl}${path}`;
    const res = await fetchWithTimeout(url, { accept });
    record(`${path}.status`, res.status === expect, `HTTP ${res.status}`);
    if (!res.ok) {
      const text = await res.text();
      record(`${path}.body`, false, text.slice(0, 120));
      return;
    }

    if (accept === 'text/event-stream') {
      const reader = res.body?.getReader();
      if (!reader) {
        record(`${path}.sse`, false, 'no readable stream body');
        return;
      }
      const { value } = await reader.read();
      await reader.cancel();
      const chunk = value ? new TextDecoder().decode(value) : '';
      const firstLine = chunk.split(/\r?\n/).find(Boolean) || '(no event line)';
      record(`${path}.sse`, firstLine.startsWith('event:') || firstLine.startsWith('data:'), firstLine);
    } else {
      await res.text();
    }
  } catch (err) {
    record(`${path}.fetch`, false, err?.name === 'AbortError' ? 'timeout' : err.message);
  }
}

async function main() {
  console.log(`[emergent-lock] Probe - ${new Date().toISOString()}`);
  console.log(`[emergent-lock] Base URL - ${baseUrl}`);

  await probeRoot();
  await probeEndpoint('/api/stream/public', { accept: 'text/event-stream' });
  await probeEndpoint('/api/clients');
  await probeEndpoint('/api/clients/js');
  await probeEndpoint('/api/clients/py');

  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length === 0) {
    console.log(`[emergent-lock] SUMMARY: PASS (${results.length} checks)`);
    process.exitCode = 0;
    return;
  }

  console.log(`[emergent-lock] SUMMARY: FAIL (${failed.length}/${results.length} checks)`);
  console.log('[emergent-lock] Failed checks:');
  for (const f of failed) {
    console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
  }
  process.exitCode = 1;
}

await main();
