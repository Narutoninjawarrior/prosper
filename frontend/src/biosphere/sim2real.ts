/**
 * sim2real.ts — Open-Meteo payload from Bellows (three_forge/world_state.sim2real)
 */

export interface Sim2RealWeather {
  source?: string
  fetched_at?: string | null
  latitude?: number
  longitude?: number
  temperature?: number
  windspeed_kmh?: number
  wind_direction_deg?: number
  wind_angle?: number
  is_raining?: boolean
  weathercode?: number
  is_day?: boolean
  error?: string | null
}

export function normalizeSim2Real(raw: unknown): Sim2RealWeather | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    source: typeof o.source === 'string' ? o.source : undefined,
    fetched_at: typeof o.fetched_at === 'string' ? o.fetched_at : null,
    latitude: typeof o.latitude === 'number' ? o.latitude : undefined,
    longitude: typeof o.longitude === 'number' ? o.longitude : undefined,
    temperature: typeof o.temperature === 'number' ? o.temperature : undefined,
    windspeed_kmh: typeof o.windspeed_kmh === 'number' ? o.windspeed_kmh : undefined,
    wind_direction_deg:
      typeof o.wind_direction_deg === 'number' ? o.wind_direction_deg : undefined,
    wind_angle: typeof o.wind_angle === 'number' ? o.wind_angle : undefined,
    is_raining: typeof o.is_raining === 'boolean' ? o.is_raining : undefined,
    weathercode: typeof o.weathercode === 'number' ? o.weathercode : undefined,
    is_day: typeof o.is_day === 'boolean' ? o.is_day : undefined,
    error: typeof o.error === 'string' ? o.error : null,
  }
}

/** Ambient tint from °C — cool below 10, warm above 28. */
export function temperatureAmbientColor(temp: number | undefined): string {
  if (temp == null || Number.isNaN(temp)) return '#F5DFC0'
  if (temp < 10) return '#D4E4F2'
  if (temp < 18) return '#E8E0D4'
  if (temp > 32) return '#FFE4B8'
  if (temp > 26) return '#F5DFC0'
  return '#F0E6D0'
}

export function temperatureHemisphereSky(temp: number | undefined): string {
  if (temp == null || Number.isNaN(temp)) return '#87CEEB'
  if (temp < 10) return '#9BB8D4'
  if (temp > 30) return '#A8D8FF'
  return '#87CEEB'
}
