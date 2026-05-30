export type GraceProjectData = {
  title?: string;
  tagline?: string;
  mission?: string;
  blocker?: string;
  repo_pointer?: string;
  wallet_status?: string;
  owner?: string;
  approval_status?: string;
  decree_id?: string;
  decree_issued_at?: string;
  pulse_nonce?: string;
  handoff_note?: string;
  principles?: string[];
  current_focus?: string[];
  active_agents?: string[];
  pending_approvals?: string[];
  what_not_to_touch?: string[];
  creative_endeavors?: string[];
  do_not_chase?: string[];
  next_action?: string;
  quote?: string;
  notes?: string;
  manifest_hash?: string;
  updated_at?: string;
};

export type SanitizedHandoff = {
  text: string;
  quarantined: boolean;
  renderHash: string;
};

export const GRACE_HASH_KEY = 'hearth-grace-known-good-hash';
export const GRACE_ACK_KEY = 'hearth-grace-acknowledged';

export const FALLBACK_GRACE: GraceProjectData = {
  title: 'The Grace of the Fellowship',
  tagline: 'Build windows of truth, not walls. Make the Lodge useful, legible, and kind.',
  mission: "Turn the project's philosophy into a visible practice that future builders can understand at a glance.",
  blocker: 'Any change that weakens trust, clarity, or the human ability to understand the Lodge at a glance.',
  repo_pointer: 'D:\\Hearth\\prosper2',
  wallet_status: 'Read-only / disconnected',
  owner: 'Malaky and the Agentic Knights of Chivalry',
  approval_status: 'Awaiting Sovereign Seal',
  decree_id: 'DECREE-001',
  decree_issued_at: '2026-05-06T00:00:00Z',
  pulse_nonce: 'PULSE-2026-05-06T00:00:00Z',
  handoff_note: 'Founder note: This is the first thing a builder should read before editing the Lodge.',
  principles: [
    'Be honest before beautiful.',
    'Protect credits and reduce confusion.',
    'Prefer small useful surfaces over large speculative systems.',
    'Keep 3D secondary to human clarity.',
    'Make approvals explicit and proposals reversible.',
  ],
  current_focus: [
    'Mission Board and Builder Handoff',
    'Read-only founder coordination',
    'Graceful fallback states',
    'Clear route and vessel pointers',
  ],
  active_agents: [
    'Prosper2 - layout and philosophy steward',
    'Codex - implementation and guardrail builder',
    'Claude - reconnaissance and route confirmation',
  ],
  pending_approvals: [
    'No automatic treasury movement',
    'No minting without witnessed intent',
    'No widening beyond the Grace front door',
  ],
  what_not_to_touch: ['P0 Ledger', 'Wasm Shield', 'Treasury automation'],
  creative_endeavors: [
    'Founder Studio notes',
    'Living project seeds',
    'Reflective handoff pages',
    'Human-readable mission briefs',
  ],
  do_not_chase: [
    'Attack tooling before the platform is steady',
    'Automatic treasury movement',
    'More 3D theater',
    'Scope creep',
  ],
  next_action: 'Keep the site calm, legible, and operational. Add only the next small thing that increases trust.',
  quote: 'Grace is the ability to remain useful under pressure.',
  notes: 'Founder note: This is the first thing a builder should read before editing the Lodge.',
};

export function normalizeGraceForManifest(value: GraceProjectData) {
  const { manifest_hash: _manifestHash, updated_at: _updatedAt, ...rest } = value;
  return rest;
}

export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

export async function sha256Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sanitizeHandoffNote(raw: string): Promise<SanitizedHandoff> {
  const allowedChars = /^[A-Za-z0-9\s.,;:!?'"()-]+$/;
  if (!allowedChars.test(raw)) {
    return {
      text: '[QUARANTINED - NON-PLAINTEXT DETECTED]',
      quarantined: true,
      renderHash: '00000000',
    };
  }

  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const truncated = collapsed.substring(0, 500);
  const renderHash = (await sha256Hex(truncated)).substring(0, 8);

  return {
    text: truncated,
    quarantined: false,
    renderHash,
  };
}
