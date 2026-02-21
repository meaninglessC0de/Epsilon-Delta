import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { initDb } from './db'
import authRoutes from './routes/authRoutes'
import profileRoutes from './routes/profileRoutes'
import memoryRoutes from './routes/memoryRoutes'
import manimRoutes from './routes/manimRoutes'

const PORT = process.env.PORT ?? 3001

const app = express()

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/memory', memoryRoutes)
app.use('/api/manim', manimRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

initDb()

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
