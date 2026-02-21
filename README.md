# Epsilon-Delta
A network of mathematical agents

## Firebase setup

All user data (auth, profile, agent memory, solves) is stored in **Firebase** (Auth + Firestore).

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/).
2. **Enable Authentication** → Sign-in method → enable **Email/Password** and **Google** (for “Continue with Google” on the login page).
3. **Create a Firestore database** (production or test mode; then use Rules below).
4. **Get config**: Project settings → General → Your apps → Add web app → copy the config object.
5. **Copy `.env.example` to `.env`** and set the Firebase keys (use dummy values for local dev if needed):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
6. **Deploy Firestore rules and index** (from project root):
   ```bash
   npx firebase deploy --only firestore
   ```
   Ensure `firestore.rules` and `firestore.indexes.json` are in the project (they are).

### Migrating existing SQLite data to Firebase

1. **Service account**: Firebase Console → Project settings → Service accounts → Generate new private key. Save the JSON file and set in `.env`:
   - `FIREBASE_SERVICE_ACCOUNT_PATH=path/to/serviceAccountKey.json`
   - Or paste the JSON string as `FIREBASE_SERVICE_ACCOUNT_JSON=...`
2. **Run the migration script** (reads `data/epsilon_delta.db` and writes to Firestore `migration_pending`):
   ```bash
   npm run migrate:to-firebase
   ```
3. **Re-register** in the app with the **same email** as in the old DB. On first login, the app will copy `migration_pending/{email}` (profile, memory, solves) into your Firebase user doc and subcollection, then remove the pending doc.

### Centralized user metadata

Each user has a single Firestore document **`users/{uid}`** that holds profile + agent memory (topics, weaknesses, solve summaries). Every agent in the app (e.g. tutor, feedback) can read this doc for full user context.
