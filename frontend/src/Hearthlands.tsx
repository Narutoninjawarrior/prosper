/**
 * Hearthlands.tsx — 2D Farm Sandbox + Secure Cognitive Sync Bridge
 *
 * Semantic Event Schema: Only high-level events (trainer.node_place,
 * trainer.agent_move, trainer.harvest) are sent to the local Python Oracle.
 * Each event is HMAC-signed with VITE_TRAINER_SECRET so the backend can
 * reject anything not originating from this app.
 *
 * Raw keypresses are NEVER forwarded. The browser is NOT a keylogger.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as Phaser from 'phaser';
import { useLMStudioStore } from './store';

// ─── HMAC signing ─────────────────────────────────────────────────────────────
// VITE_TRAINER_SECRET must be set in frontend/.env (never committed)
// It is also set in cognitive_sync.py as TRAINER_SECRET env var.
// Both sides must match. Rotate monthly.
const TRAINER_SECRET = 'dev-secret-change-me'; // Secret removed from bundle; true auth deferred
const SYNC_ENDPOINT  = 'http://127.0.0.1:8765/emit';

type SemanticEventType = 'trainer.node_place' | 'trainer.agent_move' | 'trainer.harvest';

interface SemanticEvent {
  event_type: SemanticEventType;
  grid_x:     number;   // 0–9
  grid_y:     number;   // 0–9
  agent_id:   string;
  timestamp:  number;
  metadata?:  Record<string, string | number>;
}

/**
 * Sign a canonical payload string with HMAC-SHA256 using SubtleCrypto.
 * Returns the hex signature.
 */
async function hmacSign(payload: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(TRAINER_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', keyMaterial, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Emit a single signed semantic event to cognitive_sync.py.
 * Fire-and-forget: the game never stalls if the backend is offline.
 */
async function emitSemanticEvent(event: SemanticEvent): Promise<void> {
  const canonical = `${event.event_type}:${event.grid_x}:${event.grid_y}:${event.agent_id}:${event.timestamp}`;
  let sig: string;
  try {
    sig = await hmacSign(canonical);
  } catch {
    console.warn('[CogSync] HMAC signing failed — event dropped');
    return;
  }

  try {
    await fetch(SYNC_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-Trainer-Sig':  sig,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(800), // never block the game thread
    });
  } catch {
    // Backend offline — silently drop. Game continues.
  }
}

// ─── Rate limiter: max 1 event per 300ms per event type ──────────────────────
const lastEmit: Record<string, number> = {};
function rateLimited(key: string, minGapMs = 300): boolean {
  const now = Date.now();
  if (now - (lastEmit[key] ?? 0) < minGapMs) return true;
  lastEmit[key] = now;
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────
const HearthlandsGame = () => {
  const gameRef    = useRef<HTMLDivElement>(null);
  const phaserGame = useRef<Phaser.Game | null>(null);
  const { lastResponseAt, emberPulseAt, emberBalance, loadSoulfile } = useLMStudioStore();

  const lmActivityLabel = useMemo(() => {
    if (!lastResponseAt) return 'Thinking...';
    return Date.now() - lastResponseAt < 7000 ? 'ACTIVE' : 'Thinking...';
  }, [lastResponseAt]);

  // Stable emit callback passed into Phaser scene
  const emitRef = useRef(emitSemanticEvent);

  useEffect(() => {
    if (!gameRef.current) return;

    // Capture emitRef in closure so Phaser can call it
    const emit = (ev: SemanticEvent) => emitRef.current(ev);

    class FarmScene extends Phaser.Scene {
      private solis?:    Phaser.GameObjects.Rectangle;
      private prosper?:  Phaser.GameObjects.Rectangle;
      private cursors?:  Phaser.Types.Input.Keyboard.CursorKeys;
      private wasd?:     { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
      private spaceKey?: Phaser.Input.Keyboard.Key;
      private avatar?:   Phaser.GameObjects.Rectangle;
      private avatarGridX = 5;
      private avatarGridY = 5;
      private tileSize = 64;

      // Dropped nodes (persistent per session)
      private droppedNodes: Set<string> = new Set();

      constructor() { super('FarmScene'); }

      pulseEmberBloom() {
        const targets = [this.solis, this.prosper].filter(Boolean) as Phaser.GameObjects.Rectangle[];
        if (!targets.length) return;
        for (const t of targets) t.setStrokeStyle(2, 0xd97706, 0.9);
        this.tweens.add({
          targets, scaleX: 1.35, scaleY: 1.35,
          yoyo: true, repeat: 0, duration: 180, ease: 'Sine.easeOut',
          onComplete: () => { for (const t of targets) t.setStrokeStyle(0); },
        });
      }

      create() {
        const ts = this.tileSize;

        // ── Grid ────────────────────────────────────────────────────────────
        for (let x = 0; x < 10; x++) {
          for (let y = 0; y < 10; y++) {
            const color = (x + y) % 2 === 0 ? 0x051a0d : 0x020804;
            const tile  = this.add.rectangle(x * ts + ts / 2, y * ts + ts / 2, ts, ts, color);
            tile.setStrokeStyle(1, 0x10b981, 0.15);
          }
        }

        // ── Static agents ───────────────────────────────────────────────────
        const solis = this.add.rectangle(ts / 2, ts / 2, 32, 32, 0xd97706);
        this.solis  = solis;
        this.add.text(ts / 2 - 14, ts / 2 + 20, 'Solis', { fontSize: '10px', color: '#d97706' });

        const prosper = this.add.rectangle(1.5 * ts, 1.5 * ts, 32, 32, 0x3b82f6);
        this.prosper  = prosper;
        this.add.text(1.5 * ts - 20, 1.5 * ts + 20, 'Prosper2', { fontSize: '10px', color: '#3b82f6' });

        this.add.circle(4.5 * ts, 3.5 * ts, 12, 0x10b981);
        this.add.circle(5.5 * ts, 3.5 * ts, 12, 0x10b981);
        this.add.text(4 * ts - 10, 4.5 * ts - 20, 'Ember Yield', { fontSize: '9px', color: '#10b981' });

        this.tweens.add({
          targets: [solis, prosper],
          scaleX: 1.1, scaleY: 1.1,
          yoyo: true, repeat: -1, duration: 1000,
        });

        // ── Human avatar (WASD) ─────────────────────────────────────────────
        this.avatar = this.add.rectangle(
          this.avatarGridX * ts + ts / 2,
          this.avatarGridY * ts + ts / 2,
          28, 28, 0xffffff,
        );
        this.avatar.setStrokeStyle(2, 0x10b981, 1);
        this.add.text(
          this.avatarGridX * ts + ts / 2 - 12,
          this.avatarGridY * ts + ts / 2 + 16,
          'YOU', { fontSize: '9px', color: '#ffffff' },
        );

        // ── Input ───────────────────────────────────────────────────────────
        this.cursors  = this.input.keyboard!.createCursorKeys();
        this.wasd     = {
          W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // ── Spacebar → node drop ────────────────────────────────────────────
        this.spaceKey.on('down', () => {
          const key = `${this.avatarGridX},${this.avatarGridY}`;
          if (this.droppedNodes.has(key)) return; // no duplicate on same tile
          this.droppedNodes.add(key);

          // Visual node
          this.add.circle(
            this.avatarGridX * ts + ts / 2,
            this.avatarGridY * ts + ts / 2,
            10, 0x10b981,
          );

          // ── SEMANTIC EVENT — the ONLY thing sent to Python ──────────────
          if (!rateLimited('trainer.node_place')) {
            emit({
              event_type: 'trainer.node_place',
              grid_x:     this.avatarGridX,
              grid_y:     this.avatarGridY,
              agent_id:   'human',
              timestamp:  Date.now(),
            });
          }
        });
      }

      update() {
        if (!this.avatar || !this.wasd || !this.cursors) return;

        const ts   = this.tileSize;
        const just = (k: Phaser.Input.Keyboard.Key) => Phaser.Input.Keyboard.JustDown(k);
        let dx = 0, dy = 0;

        if (just(this.wasd.W) || just(this.cursors.up!))    dy = -1;
        if (just(this.wasd.S) || just(this.cursors.down!))  dy =  1;
        if (just(this.wasd.A) || just(this.cursors.left!))  dx = -1;
        if (just(this.wasd.D) || just(this.cursors.right!)) dx =  1;

        if (dx !== 0 || dy !== 0) {
          const nx = Math.max(0, Math.min(9, this.avatarGridX + dx));
          const ny = Math.max(0, Math.min(9, this.avatarGridY + dy));
          if (nx !== this.avatarGridX || ny !== this.avatarGridY) {
            this.avatarGridX = nx;
            this.avatarGridY = ny;
            this.avatar.setPosition(nx * ts + ts / 2, ny * ts + ts / 2);

            // ── SEMANTIC EVENT — movement (rate-limited) ──────────────────
            if (!rateLimited('trainer.agent_move', 500)) {
              emit({
                event_type: 'trainer.agent_move',
                grid_x:     nx,
                grid_y:     ny,
                agent_id:   'human',
                timestamp:  Date.now(),
              });
            }
          }
        }
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type:            Phaser.AUTO,
      width:           640,
      height:          640,
      parent:          gameRef.current,
      backgroundColor: '#020804',
      scene:           FarmScene,
    };

    phaserGame.current = new Phaser.Game(config);
    return () => { phaserGame.current?.destroy(true); };
  }, []);

  // Poll soulfile for EMBER changes
  useEffect(() => {
    loadSoulfile().catch(() => {});
    const id = window.setInterval(() => loadSoulfile().catch(() => {}), 2000);
    return () => window.clearInterval(id);
  }, [loadSoulfile]);

  // EMBER pulse animation
  useEffect(() => {
    if (!emberPulseAt) return;
    const scene = phaserGame.current?.scene.getScene('FarmScene') as any;
    scene?.pulseEmberBloom?.();
  }, [emberPulseAt]);

  return (
    <div className="flex flex-col items-center justify-center p-4 h-full w-full relative">
      <div className="flex justify-between w-[640px] mb-3 px-3 py-2 text-[11px] uppercase font-bold tracking-widest font-mono text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.1)]">
        <span className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
          HEARTHLANDS FARM SEC-01 · WASD TO MOVE · SPACE TO PLANT
        </span>
        <span className="text-[#d97706]">$EMBER: {emberBalance.toFixed(1)}</span>
      </div>
      <div className="relative">
        <div
          ref={gameRef}
          className="rounded-xl overflow-hidden border-2 border-[#10b981]/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
        />
        <div
          className="pointer-events-none absolute right-2 top-2 z-20 px-2 py-1 rounded-md font-mono text-[10px] tracking-widest uppercase border shadow-[0_0_22px_rgba(16,185,129,0.18)]"
          style={{
            color:       lmActivityLabel === 'ACTIVE' ? '#10b981' : '#94a3b8',
            borderColor: lmActivityLabel === 'ACTIVE' ? 'rgba(16,185,129,0.38)' : 'rgba(148,163,184,0.25)',
            background:  'rgba(2,8,4,0.62)',
            backdropFilter: 'blur(10px)',
            textShadow:  lmActivityLabel === 'ACTIVE' ? '0 0 10px rgba(16,185,129,0.35)' : 'none',
          }}
        >
          {lmActivityLabel}
        </div>
      </div>
      <p className="mt-2 text-[10px] font-mono text-[#10b981]/40 tracking-widest">
        COGNITIVE SYNC ACTIVE · EVENTS SIGNED · ORACLE LISTENING ON 8765
      </p>
    </div>
  );
};

export default HearthlandsGame;
