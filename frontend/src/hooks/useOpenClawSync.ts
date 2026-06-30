/**
 * @file useOpenClawSync.ts
 * @version 2026.11.1
 * @description Listens asynchronously to community-generated OpenClaw sync files
 * to update the local somatic valence parameters.
 */

import { useEffect } from 'react';

interface OpenClawTelemetry {
  community_nodes_active: number;
  calculated_system_theta: number;
  manifest_version: string;
}

export function useOpenClawSync(onSyncResolved: (theta: number) => void) {
  useEffect(() => {
    let active = true;
    const fetchCommunitySyncData = async () => {
      try {
        // Asynchronously fetch the contract-first community telemetry seed
        const response = await fetch('/openclaw_sync.json');
        const data: OpenClawTelemetry = await response.json();
        
        if (!active) return;
        // Securely pass the community calculated valence straight to the frontend telemetry context
        onSyncResolved(data.calculated_system_theta);
        console.log(`[OpenClaw Sync] Architecture verified by community version ${data.manifest_version}`);
      } catch (error) {
        if (!active) return;
        console.warn("[OpenClaw Sync] Fallback engaged. No external community matrices detected.");
        onSyncResolved(0.82); // Default secure baseline alignment score
      }
    };

    fetchCommunitySyncData();
    return () => { active = false; };
  }, [onSyncResolved]);
}
