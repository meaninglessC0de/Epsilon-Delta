import { Request, Response, NextFunction } from 'express'
import { admin, isFirebaseReady } from '../firebaseAdmin'

export interface FirebaseAuthRequest extends Request {
  uid?: string
}

export function requireFirebaseAuth(req: FirebaseAuthRequest, res: Response, next: NextFunction): void {
  if (!isFirebaseReady()) {
    res.status(503).json({ error: 'Auth not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or use MANIM_SKIP_AUTH=1 for local dev.' })
    return
  }
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' })
    return
  }

  const token = header.slice(7)
  admin.auth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.uid = decoded.uid
      next()
    })
    .catch((err) => {
      console.error('[requireFirebaseAuth]', err)
      if (!res.headersSent) res.status(401).json({ error: 'Invalid or expired token' })
    })
}
