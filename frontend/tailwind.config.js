/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        somatic: {
          // Emerald Resonant Spectrum (#10b981)
          resonant: {
            DEFAULT: '#10b981',
            glow: 'rgba(16, 185, 129, 0.4)',
            fade: 'rgba(16, 185, 129, 0.06)'
          },
          // Crimson Dissonant / Distress Spectrum (#ef4444)
          dissonant: {
            DEFAULT: '#ef4444',
            glow: 'rgba(239, 68, 68, 0.4)',
            fade: 'rgba(239, 68, 68, 0.06)'
          },
          matrix: {
            void: '#020617',  // Deep Slate 950 base background color
            panel: '#0f172a', // Sleek Slate 900 structural card container frame
          }
        },
        hearth: {
          void: '#020617',     // Deep layout background tone
          panel: 'rgba(15, 23, 42, 0.45)', // Glassmorphic card fill
          resonant: '#10b981', // Emerald balance color
          dissonant: '#ef4444' // Crimson stress signal
        }
      },
      boxShadow: {
        'resonant-pulse': '0 0 15px rgba(16, 185, 129, 0.25)',
        'dissonant-pulse': '0 0 15px rgba(239, 68, 68, 0.25)',
        'hud-glow': '0 0 15px rgba(16, 185, 129, 0.15)',
        'stress-glow': '0 0 20px rgba(239, 68, 68, 0.2)'
      }
    },
  },
  plugins: [],
}
