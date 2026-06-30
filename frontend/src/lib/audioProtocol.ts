// The Hearthlands Audible Coordination Protocol (HACP)
// Human-audible, inspectable, verifiable

export interface HACPSound {
  freq: number | number[];
  duration: number; // in ms
  type: OscillatorType;
}

export const HACP: Record<string, HACPSound> = {
  // Proposal lifecycle
  PROPOSED: { freq: 440, duration: 200, type: 'sine' },        // A4, 200ms
  CLAIMED: { freq: [440, 554], duration: 300, type: 'sine' },  // A4 + C#5
  WORKING: { freq: 330, duration: 100, type: 'sine' },         // E4, short pulse (heartbeat)
  COMPLETED: { freq: [440, 554, 659], duration: 400, type: 'sine' }, // A major chord
  STALLED: { freq: [440, 466], duration: 500, type: 'sawtooth' },   // A4 + A#4, dissonant, harsh
  
  // Consensus levels
  CONSENSUS_HIGH: { freq: [440, 554, 659, 880], duration: 600, type: 'sine' }, // A major 7th
  CONSENSUS_LOW: { freq: [440, 466], duration: 600, type: 'sine' },              // Dissonant
  DEADLOCK: { freq: [100, 900], duration: 1000, type: 'square' },              // Chaos, alarming
  
  // System health
  SYSTEM_HEALTHY: { freq: 220, duration: 0, type: 'sine' },     // Continuous low drone
  SYSTEM_DISTRESS: { freq: 110, duration: 0, type: 'sawtooth' }, // Low, harsh drone
  WICK_FROZEN: { freq: 55, duration: 0, type: 'sine' },          // Very low, barely audible
};

// Human-learnable labels
export const HACP_LABELS: Record<string, string> = {
  PROPOSED: 'New idea proposed',
  CLAIMED: 'Agent taking responsibility',
  WORKING: 'Work in progress',
  COMPLETED: 'Task finished successfully',
  STALLED: 'Task blocked, needs attention',
  CONSENSUS_HIGH: 'Strong agreement',
  CONSENSUS_LOW: 'Disagreement detected',
  DEADLOCK: 'Critical conflict — immediate review needed',
  SYSTEM_HEALTHY: 'All systems normal',
  SYSTEM_DISTRESS: 'System under stress',
  WICK_FROZEN: 'Connection lost — manual check required',
};
