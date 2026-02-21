import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
<<<<<<< HEAD
=======
import { initDb } from './db'
import authRoutes from './routes/authRoutes'
import profileRoutes from './routes/profileRoutes'
import memoryRoutes from './routes/memoryRoutes'
import manimRoutes from './routes/manimRoutes'
>>>>>>> 83889afee733dc3a7ee4818ed4798a2d979c2201

const PORT = process.env.PORT ?? 3001

const app = express()

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

<<<<<<< HEAD
// Auth, profile, and memory are now handled by Firebase (client + Firestore).
// Optional: mount legacy routes if you need a hybrid setup.
=======
app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/memory', memoryRoutes)
app.use('/api/manim', manimRoutes)

>>>>>>> 83889afee733dc3a7ee4818ed4798a2d979c2201
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
