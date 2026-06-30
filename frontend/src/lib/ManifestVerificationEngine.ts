/**
 * @file ManifestVerificationEngine.ts
 * @version 2026.10.4
 * @description Generates client-side SHA-256 checksum verifications
 * over contract-first JSON data seeds to validate ledger invariance.
 * ADHERES TO HEARTHLANDS normalizedPayload AND stableStringify RULES.
 */

import { stableStringify, sha256Hex } from './grace';

export interface VerificationReceipt {
  targetFile: string;
  calculatedHash: string;
  isCompliant: boolean;
  timestamp: string;
}

export class ManifestVerificationEngine {
  /**
   * Performs an asynchronous verification pass over a target JSON seed asset
   * @param fileUrl Relative browser pathing to the target contract seed
   * @param expectedManifestHash The signed hash boundary string
   */
  public static async verifySeedIntegrity(
    fileUrl: string,
    expectedManifestHash: string
  ): Promise<VerificationReceipt> {
    try {
      const response = await fetch(fileUrl);
      const json = await response.json();
      
      // Determine normalized payload according to AGENTS.md rules
      let targetPayload = json;
      if (json.members) targetPayload = json.members;
      else if (json.quests) targetPayload = json.quests;
      else if (json.rooms) targetPayload = json.rooms;
      else {
        const { manifest_hash, updated_at, ...rest } = json;
        targetPayload = rest;
      }

      // Compute the deterministic cryptographic hash client-side
      const stableStr = stableStringify(targetPayload);
      const calculatedHash = await sha256Hex(stableStr);
      
      // Validate against the expected or self-contained hash
      const actualExpected = expectedManifestHash || json.manifest_hash;
      const isCompliant = calculatedHash === actualExpected;

      return {
        targetFile: fileUrl.split('/').pop() || fileUrl,
        calculatedHash,
        isCompliant,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[Verification Engine] Failure auditing asset at ${fileUrl}:`, error);
      return {
        targetFile: fileUrl,
        calculatedHash: 'ERROR_GENERATION_FAILED',
        isCompliant: false,
        timestamp: new Date().toISOString()
      };
    }
  }
}
