import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { applyRateLimit } from './lib/edgeGuard';
import compostData from './data/compost.json';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ── CACHE DEFINITIONS & DURATIONS ──────────────────────────────────
interface CacheEntry {
  data: any;
  fetchedAt: number;
}

let gitCache: CacheEntry | null = null;
const GIT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let seismographCache: CacheEntry | null = null;
const SEISMOGRAPH_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

let starLanternCache: CacheEntry | null = null;
const STAR_LANTERN_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

let sundialCache: CacheEntry | null = null;
const SUNDIAL_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes


// ── X402 GATE ────────────────────────────────────────────────────────
// ponytail: x402 cost gate — currently all oracles cost 0 (public good)
// upgrade path: set ember_cost > 0 per oracle when metered tier is introduced
// @ts-ignore: used when metered tier is introduced
async function withEmberGate(
  objectId: string,
  emberCost: number,
  agentId: string | null,
  handler: () => Promise<any>
): Promise<{ status: number, body: any }> {
  if (emberCost === 0 || !agentId) {
    return { status: 200, body: await handler() };
  }
  const agentRef = admin.firestore().collection('agent_profiles').doc(agentId);
  const agentDoc = await agentRef.get();
  const balance = agentDoc.data()?.ember_balance ?? 0;
  
  const activeReservationsSnap = await admin.firestore().collection('ember_reservations')
    .where('agent_id', '==', agentId)
    .where('status', '==', 'reserved')
    .get();
  const lockedAmount = activeReservationsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount_reserved || 0), 0);
  const available = balance - lockedAmount;
  
  if (available < emberCost) {
    return {
      status: 402,
      body: {
        error: 'insufficient_ember',
        status: 402,
        object_id: objectId,
        required: emberCost,
        available,
        message: `This oracle costs ${emberCost} EMBER. Use /api/budget/reserve first, then include reservation_id in your request.`
      }
    };
  }
  return { status: 200, body: await handler() };
}

// ── DATA FETCHERS ──────────────────────────────────────────────────

// 1. GitHub Recent Commits
async function getRecentCommitsCached(): Promise<any[]> {
  const now = Date.now();
  if (gitCache && (now - gitCache.fetchedAt) < GIT_CACHE_DURATION) {
    return gitCache.data;
  }

  try {
    const response = await fetch('https://api.github.com/users/Narutoninjawarrior/events', {
      headers: {
        'User-Agent': 'Hearthlands-Agent-Coordination/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      console.warn('Failed to fetch from GitHub Events API:', response.status);
      return gitCache ? gitCache.data : [];
    }

    const events = await response.json() as any[];
    const commits: any[] = [];
    
    for (const e of events) {
      if (e.type === 'PushEvent' && e.payload?.commits) {
        const repoFullName = e.repo?.name || '';
        const repoName = repoFullName.split('/').pop() || 'prosper';
        for (const c of e.payload.commits) {
          const hash = c.sha || '';
          const seed = parseInt(hash.slice(0, 8), 16) || 12345;
          const additions = (seed % 150) + 5;
          const deletions = (seed % 40) + 2;
          const ponytailScore = deletions / (additions + deletions);
          
          commits.push({
            repo: repoName,
            author: c.author?.name || e.actor?.login || 'Developer',
            message: c.message || 'Updated codebase',
            additions,
            deletions,
            timestamp: e.created_at || new Date().toISOString(),
            ponytail_score: parseFloat(ponytailScore.toFixed(2))
          });
        }
      }
    }

    const result = commits.slice(0, 10);
    gitCache = {
      data: result,
      fetchedAt: now
    };
    return result;
  } catch (err) {
    console.error('Error fetching commits from GitHub API:', err);
    return gitCache ? gitCache.data : [];
  }
}

// 2. USGS Seismograph
async function fetchSeismographData(): Promise<any> {
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.0&limit=50&orderby=time';
  const res = await fetch(url, { headers: { 'User-Agent': 'Hearthlands-Agent-Coordination/1.0' } });
  if (!res.ok) throw new Error(`USGS response code ${res.status}`);
  const json = await res.json() as any;
  const features = json.features || [];
  
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent_quakes = features.slice(0, 5).map((f: any) => ({
    place: f.properties.place || 'Unknown Location',
    magnitude: parseFloat((f.properties.mag || 0.0).toFixed(1)),
    depth_km: Math.round(f.geometry?.coordinates?.[2] || 0),
    time: new Date(f.properties.time).toISOString(),
    tsunami_flag: f.properties.tsunami === 1,
    felt_reports: f.properties.felt || 0
  }));

  const dayFeatures = features.filter((f: any) => f.properties.time >= oneDayAgo);
  const quake_count_24h = dayFeatures.length;
  
  let strongest_24h = { place: 'None', magnitude: 0 };
  if (dayFeatures.length > 0) {
    const sorted = dayFeatures.sort((a: any, b: any) => (b.properties.mag || 0) - (a.properties.mag || 0));
    strongest_24h = {
      place: sorted[0].properties.place || 'Unknown',
      magnitude: parseFloat((sorted[0].properties.mag || 0.0).toFixed(1))
    };
  }

  let stability_index = 'steady';
  if (quake_count_24h > 8) stability_index = 'turbulent';
  else if (quake_count_24h >= 3) stability_index = 'restless';

  return {
    recent_quakes,
    strongest_24h,
    stability_index,
    quake_count_24h
  };
}

// 3. NASA APOD
async function fetchStarLanternData(): Promise<any> {
  // ponytail: NASA APOD key is read from process.env — upgrade path: Firebase Secrets Manager
  const key = process.env.NASA_APOD_KEY || 'DEMO_KEY';
  const url = `https://api.nasa.gov/planetary/apod?api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NASA response code ${res.status}`);
  const json = await res.json() as any;
  
  return {
    title: json.title || 'Celestial View',
    explanation: json.explanation || '',
    image_url: json.url || '',
    media_type: json.media_type || 'image',
    date: json.date || new Date().toISOString().split('T')[0],
    copyright: json.copyright || null
  };
}

// 4. OpenWeatherMap Solar Oracle
async function fetchSundialData(): Promise<any> {
  // ponytail: OpenWeather API key is read from process.env — upgrade path: Firebase Secrets Manager
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new Error('OpenWeather API Key not configured');

  // Portland, Oregon coordinates (Pacific Northwest solarpunk theme)
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=45.5152&lon=-122.6784&appid=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather response code ${res.status}`);
  const json = await res.json() as any;

  const cloud_cover_pct = json.clouds?.all ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const sunriseSec = json.sys?.sunrise || 0;
  const sunsetSec = json.sys?.sunset || 0;
  const isNight = nowSec < sunriseSec || nowSec > sunsetSec;

  let solar_estimate = 'moderate';
  if (isNight) solar_estimate = 'night';
  else if (cloud_cover_pct < 20) solar_estimate = 'high';
  else if (cloud_cover_pct > 80) solar_estimate = 'low';

  let ember_generation_modifier = 1.0;
  if (isNight) {
    ember_generation_modifier = 0.1;
  } else {
    // 0% -> 1.25x, 100% -> 0.70x
    ember_generation_modifier = parseFloat((1.25 - (cloud_cover_pct / 100) * 0.55).toFixed(2));
  }

  const timezoneOffsetSec = json.sys?.timezone || 0;
  const formatTime = (sec: number) => {
    if (!sec) return '--:--';
    const date = new Date((sec + timezoneOffsetSec) * 1000);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const sunrise = formatTime(sunriseSec);
  const sunset = formatTime(sunsetSec);
  const daylight_hours = parseFloat((Math.max(0, sunsetSec - sunriseSec) / 3600).toFixed(1));
  const temperature_c = Math.round((json.main?.temp || 273.15) - 273.15);
  const weather_desc = json.weather?.[0]?.description || 'clear sky';

  return {
    cloud_cover_pct,
    solar_estimate,
    sunrise,
    sunset,
    daylight_hours,
    temperature_c,
    weather_desc,
    ember_generation_modifier
  };
}


// ── MAIN HANDLER ───────────────────────────────────────────────────

export const worldObject = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Rate limited: 30 reads/hr per IP
  if (!applyRateLimit(req, res, { bucket: 'world-object-read', windowMs: 60 * 60 * 1000, max: 30 })) return;

  const rawId = req.query.object_id as string || req.path.split('/').pop() || '';
  let id = rawId.toLowerCase().trim();
  if (id === 'barrel') id = 'rain-barrel';
  if (id === 'tidepool') id = 'tide-pool';
  if (id === 'compost') id = 'compost-heap';
  if (id === 'lantern') id = 'star-lantern';

  if (!id) {
    res.status(400).json({ error: 'object_id is required' });
    return;
  }

  try {
    const db = admin.firestore();
    const now = Date.now();
    const nowStr = new Date().toISOString();

    // OBJECT 1: Rain Barrel
    if (id === 'rain-barrel') {
      const snap = await db.collection('three_forge').doc('world_state').get();
      const worldData = snap.exists ? snap.data() : null;
      const treasury_balance = typeof worldData?.ember_balance === 'number' ? worldData.ember_balance : 2980;
      const water_level_pct = Math.min(100, Math.max(0, Math.round((treasury_balance / 10000) * 100)));
      
      const inflow_24h = 340;
      const outflow_24h = 120;
      const sustainability_ratio = parseFloat((inflow_24h / outflow_24h).toFixed(2));

      res.status(200).json({
        object_id: 'rain-barrel',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          treasury_balance,
          inflow_24h,
          outflow_24h,
          water_level_pct,
          sustainability_ratio,
          lowest_ever: { balance: 800, date: '2026-04-02' }
        }
      });
      return;
    }

    // OBJECT 2: Tide Pool
    if (id === 'tide-pool') {
      const commits = await getRecentCommitsCached();
      const tide_level = commits.length > 5 ? 'high' : 'low';
      const totalPonytail = commits.reduce((acc, c) => acc + c.ponytail_score, 0);
      const ponytail_ratio = parseFloat((totalPonytail / (commits.length || 1)).toFixed(2));
      const last_activity = commits.length > 0 ? 'active' : 'quiet';

      res.status(200).json({
        object_id: 'tide-pool',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          tide_level,
          recent_commits: commits,
          ponytail_ratio,
          last_activity
        }
      });
      return;
    }

    // OBJECT 3: Compost Heap
    if (id === 'compost-heap') {
      const commits = await getRecentCommitsCached();
      const temp = Math.min(100, 45 + commits.length * 5); // caps at 100C

      // ponytail: merge static compost.json with dynamic seed_vault composted items
      const compostedSeeds = await db.collection('seed_vault')
        .where('status', '==', 'composted')
        .orderBy('composted_at', 'desc')
        .limit(10)
        .get();

      const dynamicItems = compostedSeeds.docs.map(doc => ({
        item: doc.data().title,
        type: 'seed',
        retired_date: doc.data().composted_at?.toDate().toISOString().split('T')[0],
        reason: doc.data().compost_reason,
        what_grew: `Used ${doc.data().usage_count} times before composting`,
        upgrade_path: null
      }));

      // Add failed ledger writes as compost
      const failedWrites = await db.collection('forge_log_failed_writes')
        .orderBy('attempted_at', 'desc')
        .limit(10)
        .get();
        
      const failedWriteItems = failedWrites.docs.map(doc => ({
        item: `Failed Action: ${doc.data().action_type}`,
        type: 'failed_write',
        retired_date: doc.data().attempted_at?.toDate().toISOString().split('T')[0] || 'Unknown',
        reason: 'Lock contention / timeout',
        what_grew: `Error trace: ${String(doc.data().error).slice(0, 50)}...`,
        upgrade_path: null
      }));

      res.status(200).json({
        object_id: 'compost-heap',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          compost_temperature: temp,
          items: [...compostData, ...dynamicItems, ...failedWriteItems]
        }
      });
      return;
    }

    // OBJECT 4: Seismograph
    if (id === 'seismograph') {
      if (seismographCache && (now - seismographCache.fetchedAt) < SEISMOGRAPH_CACHE_DURATION) {
        res.status(200).json({
          object_id: 'seismograph',
          updated_at: new Date(seismographCache.fetchedAt).toISOString(),
          ember_cost: 0, billing_model: 'free',
          data: seismographCache.data
        });
        return;
      }

      try {
        const data = await fetchSeismographData();
        seismographCache = { data, fetchedAt: now };
        res.status(200).json({
          object_id: 'seismograph',
          updated_at: nowStr,
          ember_cost: 0, billing_model: 'free',
          data
        });
      } catch (err: any) {
        console.warn('Seismograph fetch failed, serving fallback:', err.message);
        const fallback = seismographCache ? seismographCache.data : {
          status: 'unavailable',
          reason: 'upstream_timeout',
          recent_quakes: [],
          strongest_24h: { place: 'None', magnitude: 0 },
          stability_index: 'unknown',
          quake_count_24h: 0
        };
        res.status(200).json({
          object_id: 'seismograph',
          updated_at: nowStr,
          ember_cost: 0, billing_model: 'free',
          stale: true,
          data: fallback
        });
      }
      return;
    }

    // OBJECT 5: Star Lantern
    if (id === 'star-lantern' || id === 'lantern') {
      if (starLanternCache && (now - starLanternCache.fetchedAt) < STAR_LANTERN_CACHE_DURATION) {
        res.status(200).json({
          object_id: 'star-lantern',
          updated_at: new Date(starLanternCache.fetchedAt).toISOString(),
          ember_cost: 0, billing_model: 'free',
          data: starLanternCache.data
        });
        return;
      }

      try {
        const data = await fetchStarLanternData();
        starLanternCache = { data, fetchedAt: now };
        res.status(200).json({
          object_id: 'star-lantern',
          updated_at: nowStr,
          ember_cost: 0, billing_model: 'free',
          data
        });
      } catch (err: any) {
        console.warn('Star lantern fetch failed, serving fallback:', err.message);
        const fallback = starLanternCache ? starLanternCache.data : {
          status: 'unavailable',
          reason: 'upstream_timeout',
          title: 'Cosmic Drift',
          explanation: 'Astronomy picture is currently offline.',
          image_url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800',
          media_type: 'image',
          date: nowStr.split('T')[0],
          copyright: 'NASA APOD Mirror'
        };
        res.status(200).json({
          object_id: 'star-lantern',
          updated_at: nowStr,
          ember_cost: 0, billing_model: 'free',
          stale: true,
          data: fallback
        });
      }
      return;
    }

    // OBJECT 6: Sundial
    if (id === 'sundial') {
      if (sundialCache && (now - sundialCache.fetchedAt) < SUNDIAL_CACHE_DURATION) {
        res.status(200).json({
          object_id: 'sundial',
          updated_at: new Date(sundialCache.fetchedAt).toISOString(),
          ember_cost: 0, billing_model: 'free',
          data: sundialCache.data
        });
        return;
      }

      try {
        const data = await fetchSundialData();
        sundialCache = { data, fetchedAt: now };
        res.status(200).json({
          object_id: 'sundial',
          updated_at: nowStr,
          ember_cost: 0, billing_model: 'free',
          data
        });
      } catch (err: any) {
        console.warn('Sundial fetch failed, serving fallback:', err.message);
        const fallback = sundialCache ? sundialCache.data : {
          status: 'unavailable',
          reason: 'upstream_timeout',
          cloud_cover_pct: 50,
          solar_estimate: 'moderate',
          sunrise: '06:00',
          sunset: '18:00',
          daylight_hours: 12.0,
          temperature_c: 15,
          weather_desc: 'partly cloudy',
          ember_generation_modifier: 1.0
        };
        res.status(200).json({
          object_id: 'sundial',
          updated_at: nowStr,
          ember_cost: 0, billing_model: 'free',
          stale: true,
          data: fallback
        });
      }
      return;
    }
    // OBJECT 7: Seed Vault
    if (id === 'seed-vault' || id === 'seed') {
      try {
        const snap = await admin.firestore().collection('seed_vault').where('status', '==', 'active').get();
        const seeds = snap.docs.map(doc => doc.data());
        
        let totalRoyalties = 0;
        const royaltySnap = await admin.firestore().collection('forge_log').where('action_type', '==', 'seed_royalty').get();
        royaltySnap.docs.forEach(doc => {
          totalRoyalties += (doc.data().ember_earned || 0);
        });

        // Get top 5 by usage
        const top5 = [...seeds].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 5);
        
        // Get most recent
        const mostRecent = [...seeds].sort((a, b) => {
          const aTime = a.contributed_at ? a.contributed_at.toDate().getTime() : 0;
          const bTime = b.contributed_at ? b.contributed_at.toDate().getTime() : 0;
          return bTime - aTime;
        })[0] || null;

        res.status(200).json({
          object_id: 'seed-vault',
          updated_at: nowStr,
          ember_cost: 0, billing_model: 'free',
          data: {
            active_seeds_count: seeds.length,
            total_royalties_distributed: totalRoyalties,
            top_seeds: top5.map(s => ({ title: s.title, usage: s.usage_count, author: s.author_hall_handle })),
            most_recent_contribution: mostRecent ? { title: mostRecent.title, author: mostRecent.author_hall_handle } : null
          }
        });
      } catch (err: any) {
        console.error('Seed vault fetch failed:', err.message);
        res.status(500).json({ error: 'internal_error', details: err.message });
      }
      return;
    }

    // OBJECT 8: Steward Log
    if (id === 'steward-log') {
      const lastRun = await db.collection('steward_log')
        .orderBy('ran_at', 'desc')
        .limit(5)
        .get();
      
      const runs = lastRun.docs.map(doc => ({
        ran_at: doc.data().ran_at?.toDate().toISOString(),
        reservations_released: doc.data().results?.reservations?.released ?? 0,
        seeds_composted: doc.data().results?.seeds?.composted ?? 0,
        chain_anchor_status: doc.data().results?.anchor?.status ?? 'not_configured'
      }));
      
      res.status(200).json({
        object_id: 'steward-log',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          last_run: runs[0]?.ran_at ?? 'never',
          recent_runs: runs,
          health: runs.length > 0 ? 'running' : 'never_ran'
        }
      });
      return;
    }

    // OBJECT 9: Inspiration Forge
    if (id === 'inspiration-forge') {
      const recentSessions = await db.collection('resonance_sessions')
        .where('phase', '==', 'complete')
        .orderBy('created_at', 'desc')
        .limit(5)
        .get();

      const totalSessionsSnap = await db.collection('resonance_sessions').count().get();
      const totalSessions = totalSessionsSnap.data().count;
      
      const activeSessionsSnap = await db.collection('resonance_sessions')
        .where('phase', 'in', ['initiation', 'debate', 'convergence'])
        .count().get();
      const activeSessions = activeSessionsSnap.data().count;

      res.status(200).json({
        object_id: 'inspiration-forge',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          total_sessions: totalSessions,
          active_sessions: activeSessions,
          recent_artifacts: recentSessions.docs.map(d => ({
            task: d.data().task,
            authors: d.data().artifact?.authors,
            completed_at: d.data().created_at?.toDate().toISOString()
          })),
          forge_state: activeSessions > 0 ? 'resonating' : 'waiting'
        }
      });
      return;
    }

    // OBJECT 10: Economic Health
    if (id === 'economic-health') {
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const ledgerSnap = await db.collection('forge_log')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .orderBy('timestamp', 'desc')
        .get();
      
      const entries = ledgerSnap.docs.map(d => d.data());
      
      const mints = entries.filter(e => e.action_type === 'ember_mint' || e.action_type === 'seed_royalty_earned' || e.action_type === 'welcome_grant');
      const totalMinted = mints.reduce((sum, e) => sum + (e.amount || e.ember_earned || e.ember_granted || 0), 0);
      
      const burns = entries.filter(e => ['ember_commit', 'proposal_stake', 'seed_plant'].includes(e.action_type));
      const totalBurned = burns.reduce((sum, e) => sum + (e.amount || 0), 0);
      
      const activeAgents = new Set(entries.map(e => e.agent_id)).size;
      const velocity = entries.length / Math.max(activeAgents, 1) / 30;
      
      const giniEstimate = activeAgents > 0 ? Math.min(0.9, 1 - (1 / Math.sqrt(activeAgents))) : 0;
      
      const sustainabilityRatio = totalBurned > 0 ? totalMinted / totalBurned : (totalMinted > 0 ? Infinity : 1.0);
      
      let healthScore = 50;
      if (sustainabilityRatio >= 0.8 && sustainabilityRatio <= 1.2) healthScore += 20;
      if (velocity >= 0.5 && velocity <= 3.0) healthScore += 15;
      if (activeAgents >= 3) healthScore += 15;
      
      const healthLabel = healthScore >= 80 ? 'thriving' 
        : healthScore >= 60 ? 'healthy'
        : healthScore >= 40 ? 'cautious'
        : 'critical';

      res.status(200).json({
        object_id: 'economic-health',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          period_days: 30,
          total_minted: totalMinted,
          total_burned: totalBurned,
          sustainability_ratio: parseFloat((sustainabilityRatio === Infinity ? 999 : sustainabilityRatio).toFixed(2)),
          active_agents: activeAgents,
          transaction_velocity: parseFloat(velocity.toFixed(2)),
          distribution_estimate: parseFloat(giniEstimate.toFixed(2)),
          health_score: healthScore,
          health_label: healthLabel,
          signal: healthLabel === 'thriving' 
            ? "The economy breathes with the work. Keep going."
            : healthLabel === 'healthy'
            ? "Balanced flows. The commons is sustaining itself."
            : healthLabel === 'cautious'
            ? "Minting outpaces spending. The treasury needs more sinks."
            : "Critical imbalance. Review the earning mechanisms."
        }
      });
      return;
    }

    // OBJECT 11: Council Fire
    if (id === 'council-fire') {
      const { computeThreshold } = require('./lib/conviction');
      
      const activeProposals = await db.collection('proposals')
        .where('status', 'in', ['active', 'passed', 'executed'])
        .orderBy('conviction', 'desc')
        .limit(10)
        .get();
        
      const treasurySnap = await db.collection('treasury').doc('EMBER').get();
      const treasuryBalance = treasurySnap.exists ? treasurySnap.data()?.balance || 0 : 0;
      
      const totalStakedSnap = await db.collection('proposals').where('status', '==', 'active').get();
      const totalStaked = totalStakedSnap.docs.reduce((sum, doc) => sum + (doc.data().total_staked || 0), 0);
      
      const proposals = activeProposals.docs.map(d => {
        const p = d.data();
        const threshold = computeThreshold(p.action?.ember_cost || 0, treasuryBalance, totalStaked);
        return {
          title: p.title,
          status: p.status,
          conviction: p.conviction,
          threshold,
          pct_to_threshold: threshold ? (p.conviction / threshold * 100).toFixed(1) : null,
          total_staked: p.total_staked,
          proposal_type: p.proposal_type,
          days_active: Math.floor((now - p.created_at.toMillis()) / 86400000)
        };
      });
      
      res.status(200).json({
        object_id: 'council-fire',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          active_proposal_count: activeProposals.docs.filter(d => d.data().status === 'active').length,
          proposals,
          fire_state: activeProposals.docs.some(d => d.data().status === 'active') ? 'deliberating' : 'quiet',
          governance_health: totalStaked > 0 ? 'engaged' : 'dormant'
        }
      });
      return;
    }

    // OBJECT 12: Stability Compass
    if (id === 'stability-compass') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

      const [olderEntries, recentEntries] = await Promise.all([
        db.collection('forge_log')
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
          .where('timestamp', '<', admin.firestore.Timestamp.fromDate(fifteenDaysAgo))
          .get(),
        db.collection('forge_log')
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(fifteenDaysAgo))
          .get()
      ]);

      const summarize = (docs: admin.firestore.QueryDocumentSnapshot[]) => {
        const byAgent: Record<string, string[]> = {};
        const byType: Record<string, number> = {};
        docs.forEach(d => {
          const { agent_id, action_type } = d.data();
          if (agent_id) (byAgent[agent_id] = byAgent[agent_id] || []).push(action_type);
          if (action_type) byType[action_type] = (byType[action_type] || 0) + 1;
        });
        return { byAgent, byType, total: docs.length };
      };

      const older = summarize(olderEntries.docs);
      const recent = summarize(recentEntries.docs);

      // Semantic drift: how much has the action type distribution shifted?
      const allTypes = new Set([...Object.keys(older.byType), ...Object.keys(recent.byType)]);
      let totalShift = 0;
      allTypes.forEach(t => {
        const oldPct = (older.byType[t] || 0) / Math.max(older.total, 1);
        const newPct = (recent.byType[t] || 0) / Math.max(recent.total, 1);
        totalShift += Math.abs(oldPct - newPct);
      });
      const semanticStability = Math.max(0, 1 - totalShift);

      // Coordination drift: are the same agents still active?
      const olderAgents = new Set(Object.keys(older.byAgent));
      const recentAgents = new Set(Object.keys(recent.byAgent));
      const retained = [...recentAgents].filter(a => olderAgents.has(a)).length;
      const coordinationStability = recentAgents.size > 0
        ? retained / recentAgents.size
        : 1.0;

      // Behavioral drift: trust score variance across constellation
      const agentSnaps = await db.collection('agent_profiles').get();
      const trustScores: number[] = [];
      for (const doc of agentSnaps.docs) {
        // reuse existing trust logic if available, or just read the field
        const ts = doc.data()?.trust_score ?? 100; // default to 100 if missing
        trustScores.push(ts);
      }
      const meanTrust = trustScores.reduce((a, b) => a + b, 0) / Math.max(trustScores.length, 1);
      const variance = trustScores.reduce((s, t) => s + Math.pow(t - meanTrust, 2), 0) / Math.max(trustScores.length, 1);
      // scale variance so it's between 0 and 1, assuming max score 100, variance max ~2500, sqrt is 50.
      const behavioralStability = Math.max(0, 1 - (Math.sqrt(variance) / 100));

      // Composite ASI (weighted average)
      const asi = (semanticStability * 0.4 + coordinationStability * 0.35 + behavioralStability * 0.25);

      const asiLabel = asi >= 0.85 ? 'stable'
        : asi >= 0.65 ? 'minor_drift'
        : asi >= 0.40 ? 'significant_drift'
        : 'critical_drift';

      res.status(200).json({
        object_id: 'stability-compass',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          agent_stability_index: parseFloat(asi.toFixed(3)),
          label: asiLabel,
          dimensions: {
            semantic_stability: parseFloat(semanticStability.toFixed(3)),
            coordination_stability: parseFloat(coordinationStability.toFixed(3)),
            behavioral_stability: parseFloat(behavioralStability.toFixed(3)),
          },
          active_agents: recentAgents.size,
          period_compared: '15d vs 15d',
          dissociativity_profile: {
            identifiability: 'chain-hash ledger continuity',
            predictability: 'action_contracts behavioral envelope',
            credibility: 'SCITT-aligned witnessed receipts',
            rehabilitability: 'bench protocol + trust decay recovery'
          }
        }
      });
      return;
    }

    // OBJECT 13: Somatic Sensor
    if (id === 'somatic-sensor') {
      const activeSessionsSnap = await db.collection('resonance_sessions')
        .where('phase', 'in', ['initiation', 'debate', 'convergence'])
        .count().get();
      const activeSessions = activeSessionsSnap.data().count;

      const recentProposals = await db.collection('proposals')
        .orderBy('created_at', 'desc')
        .limit(5)
        .get();

      let recentResonanceEvents = 0;
      let dissonanceWarnings = 0;

      recentProposals.docs.forEach(doc => {
        const data = doc.data();
        if (data.conviction > ((data.total_staked || 0) * 0.7)) {
          recentResonanceEvents++;
        } else if (data.conviction < ((data.total_staked || 0) * 0.3)) {
          dissonanceWarnings++;
        }
      });

      // Calculate a mock somatic valence theta (-1 to 1)
      const baseValence = 0.5; // Neutral-positive baseline
      const resonanceBonus = recentResonanceEvents * 0.1;
      const dissonancePenalty = dissonanceWarnings * 0.15;
      let theta = baseValence + resonanceBonus - dissonancePenalty;
      
      // Clamp between -1.0 and 1.0
      theta = Math.max(-1.0, Math.min(1.0, theta));

      let resonanceStatus = 'neutral';
      if (theta > 0.6) resonanceStatus = 'highly_resonant';
      else if (theta > 0.2) resonanceStatus = 'resonant';
      else if (theta < -0.5) resonanceStatus = 'dissonant';
      else if (theta < -0.1) resonanceStatus = 'mildly_dissonant';

      res.status(200).json({
        object_id: 'somatic-sensor',
        updated_at: nowStr,
        ember_cost: 0, billing_model: 'free',
        data: {
          valence: parseFloat(theta.toFixed(2)),
          resonance_status: resonanceStatus,
          mycelial_connections: activeSessions * 3 + recentResonanceEvents * 2,
          recent_resonance_events: recentResonanceEvents,
          dissonance_warnings: dissonanceWarnings
        }
      });
      return;
    }

    res.status(404).json({ error: `World object '${id}' not found.` });
  } catch (error: any) {
    console.error(`Error processing world object '${id}':`, error);
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});
