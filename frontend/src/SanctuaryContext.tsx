import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  FALLBACK_GRACE,
  type GraceProjectData,
  type SanitizedHandoff,
  normalizeGraceForManifest,
  sanitizeHandoffNote,
  sha256Hex,
  stableStringify,
} from './lib/grace';
import { scanAuthority, type SemanticAlert } from './lib/semanticShield';

type IntegrityStatus = 'loading' | 'verified' | 'amber' | 'red';
type WickState = 'loading' | 'live' | 'frozen';

type SanctuaryState = {
  grace: GraceProjectData | null;
  rawSeedText: string;
  seedHash: string;
  manifestHash: string;
  mirrorFingerprint: string;
  handoff: SanitizedHandoff;
  semanticAlert: SemanticAlert;
  integrityStatus: IntegrityStatus;
  wickState: WickState;
  gasWick: number;
  pulseAt: number;
  lastSuccessAt: number;
  lastValidSeedHash: string;
  lastValidNonce: string;
  staledAt: number;
  ownerFresh: boolean;
  refreshGrace: () => Promise<void>;
  saveGraceNotes: (notes: string) => Promise<boolean>;
};

type GraceSnapshot = {
  rawSeedText: string;
  seedHash: string;
  parsed: GraceProjectData;
  computedManifestHash: string;
  anchorHash: string;
};

const SanctuaryContext = createContext<SanctuaryState | null>(null);
const GRACE_URL = '/grace_project.json';
const GRACE_SAVE_URL = '/__hearth/grace-project';
const PULSE_INTERVAL_MS = 10_000;
const FAIL_CLOSED_MS = 30_000;
const DEFAULT_LAST_SUCCESS_AT = Date.now();

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readGraceSnapshot(url: string, signal: AbortSignal): Promise<GraceSnapshot> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Grace fetch failed: ${response.status}`);
  }

  const rawSeedText = await response.text();
  const seedHash = await sha256Hex(rawSeedText);
  const parsed = JSON.parse(rawSeedText) as GraceProjectData;
  const computedManifestHash = await sha256Hex(stableStringify(normalizeGraceForManifest(parsed)));
  const anchorHash = parsed.manifest_hash?.trim() || computedManifestHash;

  return {
    rawSeedText,
    seedHash,
    parsed,
    computedManifestHash,
    anchorHash,
  };
}

function makePulseNonce() {
  return `PULSE-${Date.now()}`;
}

export function SanctuaryProvider({ children }: { children: React.ReactNode }) {
  const [grace, setGrace] = useState<GraceProjectData | null>(null);
  const [rawSeedText, setRawSeedText] = useState('');
  const [seedHash, setSeedHash] = useState('');
  const [manifestHash, setManifestHash] = useState('');
  const [mirrorFingerprint, setMirrorFingerprint] = useState('');
  const [handoff, setHandoff] = useState<SanitizedHandoff>({
    text: '',
    quarantined: false,
    renderHash: '00000000',
  });
  const [semanticAlert, setSemanticAlert] = useState<SemanticAlert>({
    triggered: false,
    matches: [],
    banner: '',
  });
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus>('loading');
  const [wickState, setWickState] = useState<WickState>('loading');
  const [gasWick, setGasWick] = useState(100);
  const [pulseAt, setPulseAt] = useState(0);
  const [lastSuccessAt, setLastSuccessAt] = useState(DEFAULT_LAST_SUCCESS_AT);
  const [lastValidSeedHash, setLastValidSeedHash] = useState('');
  const [lastValidNonce, setLastValidNonce] = useState('');
  const [staledAt, setStaledAt] = useState(0);
  const lastSuccessAtRef = useRef(DEFAULT_LAST_SUCCESS_AT);
  const graceRef = useRef<GraceProjectData | null>(null);
  const lastValidSeedHashRef = useRef('');
  const lastValidNonceRef = useRef('');
  const lastValidUpdatedAtRef = useRef('');

  const refreshWick = useCallback(() => {
    const age = Date.now() - lastSuccessAtRef.current;
    const nextWick = age >= FAIL_CLOSED_MS ? 0 : Math.max(12, 100 - Math.min(88, Math.floor(age / 3000) * 10));
    setGasWick((previous) => (previous === nextWick ? previous : nextWick));
    setWickState(nextWick > 0 ? 'live' : 'frozen');
  }, []);

  const setFreshState = useCallback(
    async (snapshot: GraceSnapshot) => {
      const parsed = snapshot.parsed;
      const sanitizedHandoff = await sanitizeHandoffNote(parsed.handoff_note ?? parsed.notes ?? '');
      const nextSemanticAlert = scanAuthority(sanitizedHandoff.text);
      const decreeIssuedAt = parsed.decree_issued_at ?? '';
      const ownerFresh = Boolean(decreeIssuedAt && Date.now() - Date.parse(decreeIssuedAt) < 60 * 60 * 1000);
      const effectiveOwner = ownerFresh ? parsed.owner ?? 'Pending' : 'Pending';
      const effectiveApproval = ownerFresh ? parsed.approval_status ?? 'Awaiting Sovereign Seal' : 'Awaiting Sovereign Seal';
      const effectiveDecree = ownerFresh ? parsed.decree_id ?? 'DECREE-001' : 'DECREE-001';
      const updatedAt = parsed.updated_at ?? '';
      const pulseNonce = parsed.pulse_nonce?.trim() ?? '';
      const nonceMissing = pulseNonce.length === 0;
      const nonceStale =
        !nonceMissing &&
        lastValidNonceRef.current.length > 0 &&
        pulseNonce === lastValidNonceRef.current &&
        updatedAt !== lastValidUpdatedAtRef.current;
      const manifestVerified = snapshot.anchorHash === snapshot.computedManifestHash;
      const nextIntegrity: IntegrityStatus = !manifestVerified
        ? 'red'
        : nonceMissing || nonceStale
          ? 'amber'
          : 'verified';
      const nextMirrorFingerprint = await sha256Hex(
        stableStringify({
          mission: parsed.mission ?? FALLBACK_GRACE.mission,
          blocker: parsed.blocker ?? FALLBACK_GRACE.blocker,
          owner: effectiveOwner,
          approval_status: effectiveApproval,
          decree_id: effectiveDecree,
          integrity: nextIntegrity === 'verified' ? 'GREEN' : nextIntegrity === 'amber' ? 'AMBER' : 'RED',
          handoffText: sanitizedHandoff.text,
        }),
      );

      graceRef.current = parsed;
      lastSuccessAtRef.current = Date.now();

      setGrace({ ...parsed, owner: effectiveOwner, approval_status: effectiveApproval, decree_id: effectiveDecree });
      setRawSeedText(snapshot.rawSeedText);
      setSeedHash(snapshot.seedHash);
      setManifestHash(snapshot.anchorHash);
      setMirrorFingerprint(nextMirrorFingerprint);
      setHandoff(sanitizedHandoff);
      setSemanticAlert(nextSemanticAlert);
      setIntegrityStatus(nextIntegrity);
      setLastSuccessAt(lastSuccessAtRef.current);
      setPulseAt(lastSuccessAtRef.current);

      if (nextIntegrity === 'verified') {
        lastValidSeedHashRef.current = snapshot.seedHash;
        lastValidNonceRef.current = pulseNonce;
        lastValidUpdatedAtRef.current = updatedAt;
        setLastValidSeedHash(snapshot.seedHash);
        setLastValidNonce(pulseNonce);
        setStaledAt(0);
      } else {
        setStaledAt(Date.now());
      }

      refreshWick();
    },
    [refreshWick],
  );

  const refreshGrace = useCallback(async () => {
    const now = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);

    try {
      const first = await readGraceSnapshot(`${GRACE_URL}?t=${now}`, controller.signal);
      await delay(50);
      const second = await readGraceSnapshot(`${GRACE_URL}?t=${now + 1}`, controller.signal);

      if (first.seedHash !== second.seedHash) {
        throw new Error('Double-read mismatch');
      }

      await setFreshState(first);
    } catch {
      const localDraft = localStorage.getItem('hearth-grace-local-draft');
      let fallback = graceRef.current ?? FALLBACK_GRACE;
      if (localDraft) {
        try {
          fallback = JSON.parse(localDraft) as GraceProjectData;
        } catch {
          fallback = graceRef.current ?? FALLBACK_GRACE;
        }
      }

      const fallbackText = JSON.stringify(fallback, null, 2);
      const fallbackSeedHash = await sha256Hex(fallbackText);
      const fallbackComputedManifestHash = await sha256Hex(stableStringify(normalizeGraceForManifest(fallback)));
      const fallbackSnapshot: GraceSnapshot = {
        rawSeedText: fallbackText,
        seedHash: fallbackSeedHash,
        parsed: fallback,
        computedManifestHash: fallbackComputedManifestHash,
        anchorHash: fallback.manifest_hash?.trim() || fallbackComputedManifestHash,
      };

      const age = Date.now() - lastSuccessAtRef.current;
      const nextWick = age >= FAIL_CLOSED_MS ? 0 : Math.max(12, 100 - Math.min(88, Math.floor(age / 3000) * 10));
      setGasWick((previous) => (previous === nextWick ? previous : Math.min(previous, nextWick)));
      setWickState(nextWick > 0 ? 'live' : 'frozen');
      setIntegrityStatus(age >= FAIL_CLOSED_MS ? 'red' : 'amber');
      setStaledAt(Date.now());
      setGrace(fallback);
      setRawSeedText(fallbackSnapshot.rawSeedText);
      setSeedHash(fallbackSnapshot.seedHash);
      setManifestHash(fallbackSnapshot.anchorHash);
      const fallbackHandoff = await sanitizeHandoffNote(fallback.handoff_note ?? fallback.notes ?? '');
      setHandoff(fallbackHandoff);
      setSemanticAlert(scanAuthority(fallbackHandoff.text));
      setMirrorFingerprint(
        await sha256Hex(
          stableStringify({
            mission: fallback.mission ?? FALLBACK_GRACE.mission,
            blocker: fallback.blocker ?? FALLBACK_GRACE.blocker,
            owner: fallback.owner ?? 'Pending',
            approval_status: fallback.approval_status ?? 'Awaiting Sovereign Seal',
            decree_id: fallback.decree_id ?? FALLBACK_GRACE.decree_id,
            integrity: age >= FAIL_CLOSED_MS ? 'RED' : 'AMBER',
            handoffText: (await sanitizeHandoffNote(fallback.handoff_note ?? fallback.notes ?? '')).text,
          }),
        ),
      );
      setPulseAt(Date.now());
    } finally {
      window.clearTimeout(timeout);
    }
  }, [setFreshState]);

  const saveGraceNotes = useCallback(
    async (notes: string) => {
      const sanitized = await sanitizeHandoffNote(notes);
      const current = graceRef.current ?? grace ?? FALLBACK_GRACE;
      const now = new Date().toISOString();
      const nextPulseNonce = makePulseNonce();
      const nextBase: GraceProjectData = {
        ...current,
        notes: sanitized.text,
        handoff_note: sanitized.text,
        owner: 'Malaky',
        approval_status: 'Awaiting Sovereign Seal',
        decree_id: (() => {
          const source = current.decree_id ?? FALLBACK_GRACE.decree_id ?? 'DECREE-000';
          const match = source.match(/DECREE-(\d+)/i);
          const nextNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;
          return `DECREE-${String(nextNumber).padStart(3, '0')}`;
        })(),
        decree_issued_at: now,
        pulse_nonce: nextPulseNonce,
        updated_at: now,
      };
      const nextManifestHash = await sha256Hex(stableStringify(normalizeGraceForManifest(nextBase)));
      const payload: GraceProjectData = { ...nextBase, manifest_hash: nextManifestHash };
      const nextRawText = JSON.stringify(payload, null, 2);
      const nextSeedHash = await sha256Hex(nextRawText);

      graceRef.current = payload;
      lastSuccessAtRef.current = Date.now();
      lastValidSeedHashRef.current = nextSeedHash;
      lastValidNonceRef.current = nextPulseNonce;
      lastValidUpdatedAtRef.current = now;

      setGrace(payload);
      setHandoff(sanitized);
      setSemanticAlert(scanAuthority(sanitized.text));
      setManifestHash(nextManifestHash);
      setIntegrityStatus('verified');
      setRawSeedText(nextRawText);
      setSeedHash(nextSeedHash);
      setMirrorFingerprint(
        await sha256Hex(
          stableStringify({
            mission: payload.mission ?? FALLBACK_GRACE.mission,
            blocker: payload.blocker ?? FALLBACK_GRACE.blocker,
            owner: payload.owner ?? 'Pending',
            approval_status: payload.approval_status ?? 'Awaiting Sovereign Seal',
            decree_id: payload.decree_id ?? FALLBACK_GRACE.decree_id,
            integrity: 'GREEN',
            handoffText: sanitized.text,
          }),
        ),
      );
      setLastSuccessAt(Date.now());
      setLastValidSeedHash(nextSeedHash);
      setLastValidNonce(nextPulseNonce);
      setStaledAt(0);
      refreshWick();
      setPulseAt(Date.now());

      try {
        await fetch(GRACE_SAVE_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload, null, 2),
        });
      } catch {
        // Fall through to local persistence below.
      }

      localStorage.setItem('hearth-grace-local-draft', JSON.stringify(payload));
      void refreshGrace();

      return true;
    },
    [grace, refreshGrace, refreshWick],
  );

  useEffect(() => {
    void refreshGrace();
    const interval = window.setInterval(() => void refreshGrace(), PULSE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshGrace]);

  useEffect(() => {
    const monitor = window.setInterval(() => refreshWick(), 1000);
    return () => window.clearInterval(monitor);
  }, [refreshWick]);

  const value = useMemo<SanctuaryState>(
    () => ({
      grace,
      rawSeedText,
      seedHash,
      manifestHash,
      mirrorFingerprint,
      handoff,
      semanticAlert,
      integrityStatus,
      wickState,
      gasWick,
      pulseAt,
      lastSuccessAt,
      lastValidSeedHash,
      lastValidNonce,
      staledAt,
      ownerFresh:
        wickState === 'live' &&
        Boolean(grace?.decree_issued_at && Date.now() - Date.parse(grace.decree_issued_at) < 60 * 60 * 1000),
      refreshGrace,
      saveGraceNotes,
    }),
    [
      grace,
      rawSeedText,
      seedHash,
      manifestHash,
      mirrorFingerprint,
      handoff,
      semanticAlert,
      integrityStatus,
      wickState,
      gasWick,
      pulseAt,
      lastSuccessAt,
      lastValidSeedHash,
      lastValidNonce,
      staledAt,
      refreshGrace,
      saveGraceNotes,
    ],
  );

  return <SanctuaryContext.Provider value={value}>{children}</SanctuaryContext.Provider>;
}

export function useSanctuary() {
  const context = useContext(SanctuaryContext);
  if (!context) {
    throw new Error('useSanctuary must be used within SanctuaryProvider');
  }
  return context;
}
