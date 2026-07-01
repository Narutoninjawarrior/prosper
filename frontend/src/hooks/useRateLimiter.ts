import { useState, useCallback } from 'react';

/**
 * @file useRateLimiter.ts
 * @version 2026.30.2
 * @description Defensive client-side throttle hook to insulate input handlers
 * from high-frequency browser execution loops and automated script spam.
 */
export const useRateLimiter = (cooldownMs: number = 5000) => {
  const [isThrottled, setIsThrottled] = useState<boolean>(false);

  const triggerCooldown = useCallback(() => {
    setIsThrottled(true);
    setTimeout(() => {
      setIsThrottled(false);
    }, cooldownMs);
  }, [cooldownMs]);

  return { isThrottled, triggerCooldown };
};
