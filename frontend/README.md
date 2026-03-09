# TeamChat AI Frontend (React + Firebase)

React 18 + TypeScript frontend for the TeamChat AI assessment.

This app:

- Uses **Firebase Auth (email/password)** for login
- Stores the selected **organization slug** client-side
- Connects directly to **Firestore** for rooms, messages, presence, and typing
- Calls the FastAPI backend to invoke **Gemini AI** when users mention `@Gemini` or `@AI`

## Prerequisites

- Node.js 18+
- A Firebase project with:
  - Email/password sign-in enabled
  - Firestore (in production mode)
  - Pre-seeded users, orgs, rooms, and messages (matching your backend model)

## Setup

1. **Install dependencies**

   ```bash
   cd frontend
   npm install
   ```

2. **Environment variables**

   Create a `.env` file in `frontend/`:

   ```bash
   VITE_FIREBASE_API_KEY=<your_firebase_api_key>
   VITE_FIREBASE_AUTH_DOMAIN=<your_firebase_auth_domain>
   VITE_FIREBASE_PROJECT_ID=<your_firebase_project_id>
   VITE_API_BASE_URL=http://localhost:8000
   ```

   - `VITE_API_BASE_URL` should point to your FastAPI backend (Cloud Run URL in production).

3. **Run the dev server**

   ```bash
   npm run dev
   ```

4. **Login**

   - Open the URL printed by Vite (usually `http://localhost:5173`).
   - Enter:
     - **Organization slug** (e.g. `acme`)
     - **Email** and **Password** for a pre-seeded Firebase user.

## How it works

- After login, the app:
  - Subscribes to `organizations/{orgSlug}/rooms` where `memberIds` contains the current user
  - Subscribes to `organizations/{orgSlug}/rooms/{roomId}/messages` for the active room
  - Updates and reads `presence` and `typing` collections to show online users and typing indicators
  - When a message contains `@Gemini` or `@AI`, it calls:

    ```text
    POST /api/orgs/{orgSlug}/rooms/{roomId}/ai/complete
    ```

    with the Firebase ID token so the backend can validate access.

- The AI response is streamed into a Firestore `messages` document, and all clients see it update in real time.

