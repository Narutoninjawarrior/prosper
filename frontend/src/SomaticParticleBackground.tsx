/**
 * @file SomaticParticleBackground.tsx
 * @version 2026.5.2
 * @description Pure HTML5 Canvas background that generates a drifting node network.
 * Velocity and chaos jitter adapt dynamically to the system's live Somatic Valence score.
 */

import React, { useEffect, useRef } from 'react';

interface ParticleProps {
  theta: number; // Injected from useAffectiveTelemetry hook (-1.0 to 1.0)
}

export const SomaticParticleBackground: React.FC<ParticleProps> = ({ theta }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const clickRippleRef = useRef({ x: -1000, y: -1000, radius: 0, maxRadius: 250, speed: 6.0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Initialize particle structure arrays
    const particleCount = 65;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      clickRippleRef.current.x = e.clientX;
      clickRippleRef.current.y = e.clientY;
      clickRippleRef.current.radius = 0;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    // Using window.addEventListener to catch all clicks, as the canvas is pointer-events-none
    window.addEventListener('click', handleCanvasClick);

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      const speedMultiplier = theta < 0 ? 2.5 : 1.0;
      
      ctx.strokeStyle = theta < 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.06)';
      ctx.fillStyle = theta < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.2)';

      // 4. Update the ripple width frame on every single loop frame step
      if (clickRippleRef.current.radius < clickRippleRef.current.maxRadius) {
        clickRippleRef.current.radius += clickRippleRef.current.speed;
        
        ctx.beginPath();
        ctx.arc(clickRippleRef.current.x, clickRippleRef.current.y, clickRippleRef.current.radius, 0, Math.PI * 2);
        ctx.strokeStyle = theta < 0 
          ? `rgba(239, 68, 68, ${0.1 * (1 - clickRippleRef.current.radius / clickRippleRef.current.maxRadius)})` 
          : `rgba(16, 185, 129, ${0.1 * (1 - clickRippleRef.current.radius / clickRippleRef.current.maxRadius)})`;
        ctx.stroke();
      }

      particles.forEach((p, i) => {
        // 3. Inject this math calculation step into your active particle render execution block
        const ripple = clickRippleRef.current;
        if (ripple.radius < ripple.maxRadius) {
          const dx = p.x - ripple.x;
          const dy = p.y - ripple.y;
          const distance = Math.hypot(dx, dy);

          // Check if the particle is caught within the expanding ripple wake
          if (distance > ripple.radius - 15 && distance < ripple.radius + 15) {
            const angle = Math.atan2(dy, dx);
            const pushIntensity = (1.0 - ripple.radius / ripple.maxRadius) * 4.0;
            
            p.x += Math.cos(angle) * pushIntensity;
            p.y += Math.sin(angle) * pushIntensity;
          }
        }

        // Move particles with reactive speed scaling
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        // Wrap boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (theta < 0 ? 1.3 : 1.0), 0, Math.PI * 2);
        ctx.fill();

        // 1. Trace light proximity webs to neighboring nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineWidth = 0.5 * (1.0 - dist / 120);
            ctx.strokeStyle = theta < 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.06)';
            ctx.stroke();
          }
        }
        
        // 2. Interactive Mouse Trail
        const mouseDist = Math.hypot(p.x - mouseRef.current.x, p.y - mouseRef.current.y);
        if (mouseDist < 180) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
          ctx.strokeStyle = theta < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.18)';
          ctx.lineWidth = 0.8 * (1.0 - mouseDist / 180);
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('click', handleCanvasClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theta]);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none bg-[#020804] overflow-hidden">
      {/* Interactive Neon Grid Backdrop Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(16, 185, 129, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(16, 185, 129, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: 'perspective(500px) rotateX(60deg) scale(2.5) translateY(-100px)',
          transformOrigin: 'top center',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#020804] via-transparent to-transparent z-0" />
      
      <canvas ref={canvasRef} className="absolute inset-0 z-10" />
    </div>
  );
};
