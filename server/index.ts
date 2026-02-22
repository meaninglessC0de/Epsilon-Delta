import 'dotenv/config'
import express from 'express'
import path from 'path'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { initFirebaseAdmin } from './firebaseAdmin'
import manimRoutes from './routes/manimRoutes'

const PORT = process.env.PORT ?? 3001
const isProd = process.env.NODE_ENV === 'production'

initFirebaseAdmin()

const app = express()

// CORS: in dev allow Vite dev server; in prod use ORIGIN env or same-origin
const origin = process.env.ORIGIN ?? (isProd ? undefined : 'http://localhost:5173')
app.use(cors({ origin: origin || true, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

app.use('/api/manim', manimRoutes)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Production: serve built frontend + SPA fallback (single deployment)
const distPath = path.join(process.cwd(), 'dist')
if (isProd || require('fs').existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Catch unhandled errors from async routes (Express does not catch these by default)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[server] Unhandled error:', msg)
  if (err instanceof Error && err.stack) console.error('[server] Stack:', err.stack)
  if (!res.headersSent) {
    res.status(500).json({ error: msg || 'Internal server error' })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  const skipAuth = (process.env.MANIM_SKIP_AUTH ?? '').toLowerCase()
  if (skipAuth === '1' || skipAuth === 'true') {
    console.log('[manim] MANIM_SKIP_AUTH=1 — Firebase auth bypassed for /api/manim/generate')
  }
})
