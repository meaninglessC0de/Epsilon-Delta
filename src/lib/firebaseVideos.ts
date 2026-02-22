import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { db, storage, auth } from './firebase'
import type { VideoRecord } from '../../shared/types'

function videosCol(uid: string) {
  return collection(db, 'users', uid, 'videos')
}

function videoDocRef(uid: string, videoId: string) {
  return doc(db, 'users', uid, 'videos', videoId)
}

export async function getVideos(): Promise<VideoRecord[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  const q = query(videosCol(uid), orderBy('createdAt', 'desc'), limit(100))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as VideoRecord)
}

export async function saveVideo(blob: Blob, question: string): Promise<VideoRecord> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')

  const id = crypto.randomUUID()
  const path = `users/${uid}/videos/${id}.mp4`

  const sRef = storageRef(storage, path)
  await uploadBytes(sRef, blob, { contentType: 'video/mp4' })
  const downloadUrl = await getDownloadURL(sRef)

  const record: VideoRecord = { id, question, downloadUrl, storagePath: path, createdAt: Date.now() }
  await setDoc(videoDocRef(uid, id), record)
  return record
}

export async function deleteVideo(id: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return

  const snap = await getDoc(videoDocRef(uid, id))
  if (snap.exists()) {
    const record = snap.data() as VideoRecord
    try {
      await deleteObject(storageRef(storage, record.storagePath))
    } catch { /* already deleted or missing */ }
  }
  await deleteDoc(videoDocRef(uid, id))
}
