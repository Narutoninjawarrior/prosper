import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // The only remaining oversized chunk is the optional local WebLLM steward runtime.
    // It is already lazily imported and never blocks the public route entry path.
    chunkSizeWarningLimit: 6200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@react-three/fiber')) return 'r3f'
          if (id.includes('@react-three/drei')) return 'drei'
          if (id.includes('@react-three/postprocessing') || id.includes('postprocessing')) return 'postprocessing'
          if (id.includes('@react-three/rapier')) return 'rapier'
          if (id.includes('/three/') || id.includes('\\three\\') || id.includes('node_modules/three')) return 'three-core'
          if (id.includes('firebase')) return 'firebase'
          if (id.includes('@xyflow')) return 'xyflow'
          if (id.includes('phaser')) return 'phaser'
          if (id.includes('framer-motion')) return 'motion'
          const [, packagePath = 'vendor'] = id.split('node_modules/')
          const segments = packagePath.split(/[\\/]/)
          const packageName = segments[0]?.startsWith('@')
            ? `${segments[0]}-${segments[1] ?? 'pkg'}`
            : segments[0]
          return `pkg-${packageName.replace('@', '').replace(/[\\/]/g, '-')}`
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'hearth-soulfile-bridge',
      configureServer(server) {
        const soulfilePath = path.resolve(server.config.root, '..', 'soulfile_schema.json')
        const hearthDataPath = path.resolve(server.config.root, '..', 'hearth_data.json')
        const workLogPath = path.resolve(server.config.root, '..', 'work_log.json')

        interface HearthDataPayload {
          wallet_balance?: number;
          latest_receipt_note?: string;
          total_mined?: number;
          total_ticks?: number;
          [key: string]: unknown;
        }

        server.middlewares.use('/__hearth/hearth_data', async (req, res) => {
          try {
            if (req.method === 'GET') {
              let hearthData: HearthDataPayload = {}
              try {
                const raw = await fs.readFile(hearthDataPath, 'utf-8')
                hearthData = JSON.parse(raw) as HearthDataPayload
              } catch {
                // If hearth_data doesn't exist, start with empty object
              }

              // Load soulfile for wallet balance
              try {
                const rawSoul = await fs.readFile(soulfilePath, 'utf-8')
                const soul = JSON.parse(rawSoul)
                if (soul && soul.wallet && soul.wallet.balances) {
                  hearthData.wallet_balance = soul.wallet.balances.EMBER as number
                }
                if (soul && soul.latest_receipt && soul.latest_receipt.note) {
                  hearthData.latest_receipt_note = soul.latest_receipt.note as string
                }
              } catch {
                // Ignore if not present
              }

              // Load work log for mining totals
              try {
                const rawLog = await fs.readFile(workLogPath, 'utf-8')
                const log = JSON.parse(rawLog)
                if (log) {
                  if (typeof log.total_mined === 'number') {
                    hearthData.total_mined = log.total_mined
                  }
                  if (typeof log.total_ticks === 'number') {
                    hearthData.total_ticks = log.total_ticks
                  }
                }
              } catch {
                // Ignore if not present
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(hearthData))
              return
            }
            res.statusCode = 405
            res.setHeader('Allow', 'GET')
            res.end()
          } catch {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ reflections: [] }))
          }
        })

        server.middlewares.use('/__hearth/soulfile', async (req, res) => {
          try {
            if (req.method === 'GET') {
              const raw = await fs.readFile(soulfilePath, 'utf-8')
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(raw)
              return
            }

            if (req.method === 'PUT') {
              const chunks: Buffer[] = []
              req.on('data', (c) => chunks.push(c))
              req.on('end', async () => {
                try {
                  const body = Buffer.concat(chunks).toString('utf-8')
                  // Validate JSON before writing
                  const parsed = JSON.parse(body)
                  const normalized = JSON.stringify(parsed, null, 2) + '\n'
                  await fs.writeFile(soulfilePath, normalized, 'utf-8')
                  res.statusCode = 204
                  res.end()
                } catch (err) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json; charset=utf-8')
                  res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }))
                }
              })
              return
            }

            res.statusCode = 405
            res.setHeader('Allow', 'GET, PUT')
            res.end()
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Soulfile bridge error', detail: String(err) }))
          }
        })
      },
    },
  ],
})
