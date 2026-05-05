import React, { useState } from 'react';

const Gate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.toLowerCase() === 'fellows') {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1a2e1a 0%, #050a05 100%)',
      color: '#a8d5a8',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        borderRadius: '24px',
        border: '1px solid #2d4d2d',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 50px rgba(0,0,0,0.5)',
        animation: 'fadeIn 1s ease-out'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem',
          filter: 'drop-shadow(0 0 10px #4ade80)'
        }}>
          🦞
        </div>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 700, 
          letterSpacing: '-0.02em',
          marginBottom: '0.5rem',
          color: '#ffffff'
        }}>
          The Hearthlands Lodge
        </h1>
        <p style={{ color: '#63b163', marginBottom: '2rem' }}>
          The forge is hot. The bellows are breathing.<br/>
          <em>Identify yourself, Fellow.</em>
        </p>

        <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
          <input
            type="password"
            placeholder="Enter the Handshake..."
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={{
              padding: '1rem 1.5rem',
              borderRadius: '12px',
              border: `2px solid ${error ? '#ef4444' : '#2d4d2d'}`,
              background: '#050a05',
              color: '#ffffff',
              fontSize: '1rem',
              width: '280px',
              textAlign: 'center',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: error ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none'
            }}
          />
          {error && (
            <div style={{ 
              color: '#ef4444', 
              fontSize: '0.8rem', 
              marginTop: '0.5rem',
              animation: 'shake 0.2s ease-in-out infinite' 
            }}>
              Incorrect. The Hearth remains dark.
            </div>
          )}
        </form>

        <div style={{ marginTop: '3rem', fontSize: '0.7rem', color: '#3d6d3d', opacity: 0.6 }}>
          SOVEREIGN FORGE v2.0 // EST. 2026
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
      `}</style>
    </div>
  );
};

export default Gate;
