import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'hearth-soulfile-bridge',
      configureServer(server) {
        // NOTE: frontend-only changes, but we can read/write the root soulfile via the dev server.
        const soulfilePath = path.resolve(server.config.root, '..', 'soulfile_schema.json')

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
