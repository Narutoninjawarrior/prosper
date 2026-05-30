import { getFirebaseProjectId, isFirebaseConfigured } from '../firebaseConfig';

/** Read-only Phase 0 signal for the doctrine vessel (Forge Artifact Inspector). No network I/O. */
export type FirebaseBranchWiringStatus = {
  browserEnvReady: boolean;
  projectId: string | null;
  phase0Label: string;
  phase1Hint: string;
  terminalOnlyNote: string;
};

export function getFirebaseBranchWiringStatus(): FirebaseBranchWiringStatus {
  const browserEnvReady = isFirebaseConfigured();
  const projectId = browserEnvReady ? getFirebaseProjectId() : null;

  return {
    browserEnvReady,
    projectId,
    phase0Label: browserEnvReady
      ? 'Phase 0 — browser env present (`VITE_FIREBASE_*`). Firestore client can initialize read-only.'
      : 'Phase 0 — copy `frontend/.env.example` → `.env.local` and set all `VITE_FIREBASE_*` values.',
    phase1Hint: browserEnvReady
      ? 'Phase 1 — open Lodge Hall → “live registry — firestore” for supplemental reads (seeds stay canonical).'
      : 'Phase 1 — supplemental registry reads stay off until browser env is set.',
    terminalOnlyNote:
      'Phases 2–3 (export, dry-run, live sync, steward claims) run at repo root only — see `/steward-runbook.md`.',
  };
}
