import { useEffect, useMemo, useRef } from 'react';
import * as Phaser from 'phaser';
import { useLMStudioStore } from './store';

const HearthlandsGame = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGame = useRef<Phaser.Game | null>(null);
  const { lastResponseAt, emberPulseAt, emberBalance, loadSoulfile } = useLMStudioStore();

  const lmActivityLabel = useMemo(() => {
    if (!lastResponseAt) return 'Thinking...';
    return Date.now() - lastResponseAt < 7000 ? 'ACTIVE' : 'Thinking...';
  }, [lastResponseAt]);

  useEffect(() => {
    if (!gameRef.current) return;

    class FarmScene extends Phaser.Scene {
      private solis?: Phaser.GameObjects.Rectangle;
      private prosper?: Phaser.GameObjects.Rectangle;

      constructor() {
        super('FarmScene');
      }

      pulseEmberBloom() {
        const targets = [this.solis, this.prosper].filter(Boolean) as Phaser.GameObjects.Rectangle[];
        if (targets.length === 0) return;

        for (const t of targets) {
          t.setStrokeStyle(2, 0xd97706, 0.9);
        }

        this.tweens.add({
          targets,
          scaleX: 1.35,
          scaleY: 1.35,
          yoyo: true,
          repeat: 0,
          duration: 180,
          ease: 'Sine.easeOut',
          onComplete: () => {
            for (const t of targets) t.setStrokeStyle(0);
          },
        });
      }

      create() {
        // Create 10x10 grid (Hearthlands Farm Sec-01)
        const tileSize = 64;
        const gridColor1 = 0x051a0d; // Dark solarpunk verdant
        const gridColor2 = 0x020804; // Almost black

        // Draw the local memory grid
        for (let x = 0; x < 10; x++) {
          for (let y = 0; y < 10; y++) {
            const color = (x + y) % 2 === 0 ? gridColor1 : gridColor2;
            const tile = this.add.rectangle(x * tileSize + tileSize/2, y * tileSize + tileSize/2, tileSize, tileSize, color);
            tile.setStrokeStyle(1, 0x10b981, 0.15); // Neon green faint stroke
          }
        }

        // Add Solis (Electric Amber Agent)
        const solis = this.add.rectangle(tileSize/2, tileSize/2, 32, 32, 0xd97706);
        this.solis = solis;
        this.add.text(tileSize/2 - 14, tileSize/2 + 20, 'Solis', { fontSize: '10px', color: '#d97706' });

        // Add Prosper2 (Azure Blue Agent)
        const prosper = this.add.rectangle(1.5 * tileSize, 1.5 * tileSize, 32, 32, 0x3b82f6);
        this.prosper = prosper;
        this.add.text(1.5 * tileSize - 20, 1.5 * tileSize + 20, 'Prosper2', { fontSize: '10px', color: '#3b82f6' });
        
        // Add Crops / Data Nodes
        this.add.circle(4.5 * tileSize, 3.5 * tileSize, 12, 0x10b981);
        this.add.circle(5.5 * tileSize, 3.5 * tileSize, 12, 0x10b981);
        this.add.text(4 * tileSize - 10, 4.5 * tileSize - 20, 'Ember Yield', { fontSize: '9px', color: '#10b981' });

        // Pulse the agents slightly to simulate heartbeat
        this.tweens.add({
            targets: [solis, prosper],
            scaleX: 1.1,
            scaleY: 1.1,
            yoyo: true,
            repeat: -1,
            duration: 1000
        });
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 640,
      height: 640,
      parent: gameRef.current,
      backgroundColor: '#020804',
      scene: FarmScene
    };

    phaserGame.current = new Phaser.Game(config);

    return () => {
      phaserGame.current?.destroy(true);
    };
  }, []);

  useEffect(() => {
    // Poll soulfile to detect EMBER yield changes (heartbeat.py updates should reflect here).
    loadSoulfile().catch(() => {});
    const id = window.setInterval(() => loadSoulfile().catch(() => {}), 2000);
    return () => window.clearInterval(id);
  }, [loadSoulfile]);

  useEffect(() => {
    if (!emberPulseAt) return;
    const scene = phaserGame.current?.scene.getScene('FarmScene') as any;
    scene?.pulseEmberBloom?.();
  }, [emberPulseAt]);

  return (
    <div className="flex flex-col items-center justify-center p-4 h-full w-full relative">
      <div className="flex justify-between w-[640px] mb-3 px-3 py-2 text-[11px] uppercase font-bold tracking-widest font-mono text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></div> HEARTHLANDS FARM SEC-01</span>
          <span className="text-[#d97706]">$EMBER: {emberBalance.toFixed(1)}</span>
      </div>
      <div className="relative">
        <div ref={gameRef} className="rounded-xl overflow-hidden border-2 border-[#10b981]/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]" />
        <div
          className="pointer-events-none absolute right-2 top-2 z-20 px-2 py-1 rounded-md font-mono text-[10px] tracking-widest uppercase border shadow-[0_0_22px_rgba(16,185,129,0.18)]"
          style={{
            color: lmActivityLabel === 'ACTIVE' ? '#10b981' : '#94a3b8',
            borderColor: lmActivityLabel === 'ACTIVE' ? 'rgba(16,185,129,0.38)' : 'rgba(148,163,184,0.25)',
            background: 'rgba(2,8,4,0.62)',
            backdropFilter: 'blur(10px)',
            textShadow: lmActivityLabel === 'ACTIVE' ? '0 0 10px rgba(16,185,129,0.35)' : 'none',
          }}
        >
          {lmActivityLabel}
        </div>
      </div>
    </div>
  );
};

export default HearthlandsGame;
