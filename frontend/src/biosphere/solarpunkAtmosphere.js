/**
 * Solarpunk visual tuning — bright, warm, hopeful (inspired by Cyberwave's Solarpunk™
 * and stylized environment art: dual warm/cool lights, high saturation, soft bloom).
 */

export const SOLARPUNK = {
  fog: '#5A3927',
  fogNear: 24,
  fogFar: 62,
  ambientIntensity: 0.58,
  sunIntensity: 1.25,
  sunColor: '#FFD7A1',
  fillSky: '#FFD7A1',
  fillGround: '#355033',
  bloomIntensity: 1.55,
  bloomThreshold: 0.5,
  vignetteDarkness: 0.22,
  toneExposure: 1.12,
  skyTurbidity: 4.8,
}

export function brightAmbientForWeather(sim2real) {
  if (!sim2real) return SOLARPUNK.ambientIntensity
  if (sim2real.is_raining) return 0.42
  if (sim2real.is_day === false) return 0.38
  if (sim2real.temperature > 26) return 0.58
  return SOLARPUNK.ambientIntensity
}
