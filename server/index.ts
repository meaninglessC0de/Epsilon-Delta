import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const PORT = process.env.PORT ?? 3001

const app = express()

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// Auth, profile, and memory are now handled by Firebase (client + Firestore).
// Optional: mount legacy routes if you need a hybrid setup.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
