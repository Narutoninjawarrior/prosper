// functions/src/lib/conviction.ts
// ponytail: pure math, no side effects, fully testable

export interface ConvictionParams {
  halfLifeHours: number;   // 48 for Hearthlands default
  maxRatio: number;        // 0.10 = max 10% of treasury per proposal
  minThreshold: number;    // 0.025 = min 2.5% of effective stake
  minEffectiveStakeRatio: number; // 0.20 = min 20% total EMBER must be staked
}

export const HEARTHLANDS_PARAMS: ConvictionParams = {
  halfLifeHours: 48,
  maxRatio: 0.10,
  minThreshold: 0.025,
  minEffectiveStakeRatio: 0.20,
};

/**
 * Compute alpha (decay rate) from half-life.
 * alpha = 0.5^(1/halfLife_in_hours) for hourly ticks
 */
export function computeAlpha(halfLifeHours: number): number {
  return Math.pow(0.5, 1 / halfLifeHours);
}

/**
 * Update conviction for one time step.
 * conviction(t) = alpha * conviction(t-1) + total_staked
 */
export function stepConviction(
  currentConviction: number,
  totalStaked: number,
  hoursElapsed: number,
  params: ConvictionParams = HEARTHLANDS_PARAMS
): number {
  const alpha = computeAlpha(params.halfLifeHours);
  // For multiple hours elapsed, apply compound decay
  const decayFactor = Math.pow(alpha, hoursElapsed);
  return decayFactor * currentConviction + totalStaked * (1 - decayFactor) / (1 - alpha);
}

/**
 * Compute the conviction threshold required for a proposal to pass.
 * Based on 1Hive Gardens production formula.
 * 
 * threshold = minThreshold * effectiveStake + 
 *             (weight * effectiveStake * treasury^2) / 
 *             (maxRatio * treasury - requestedAmount)^2
 */
export function computeThreshold(
  requestedAmount: number,  // EMBER requested
  treasuryBalance: number,  // Current EMBER treasury
  totalStaked: number,      // Total EMBER staked across all proposals
  params: ConvictionParams = HEARTHLANDS_PARAMS
): number | null {
  // Guard: requested amount must be less than maxRatio * treasury
  if (requestedAmount >= params.maxRatio * treasuryBalance) {
    return null; // Proposal exceeds maximum allowed
  }
  
  const effectiveStake = Math.max(
    totalStaked,
    params.minEffectiveStakeRatio * treasuryBalance
  );
  
  const minConviction = params.minThreshold * effectiveStake;
  
  const denom = params.maxRatio * treasuryBalance - requestedAmount;
  const weightedConviction = (0.0025 * effectiveStake * Math.pow(treasuryBalance, 2)) / Math.pow(denom, 2);
  
  return minConviction + weightedConviction;
}

/**
 * Check if a proposal should pass based on current conviction vs threshold.
 */
export function shouldProposalPass(
  proposal: { conviction: number; action: { ember_cost: number } },
  treasuryBalance: number,
  totalStaked: number,
  params: ConvictionParams = HEARTHLANDS_PARAMS
): { pass: boolean; threshold: number | null; deficit: number } {
  const threshold = computeThreshold(
    proposal.action.ember_cost,
    treasuryBalance,
    totalStaked,
    params
  );
  
  if (threshold === null) {
    return { pass: false, threshold: null, deficit: Infinity };
  }
  
  return {
    pass: proposal.conviction >= threshold,
    threshold,
    deficit: Math.max(0, threshold - proposal.conviction)
  };
}
