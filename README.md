# TeamChat AI – Multi-Tenant Collaborative Chat

TeamChat AI is a **multi-tenant, real-time collaborative AI chat platform** where multiple users from the same organization can chat together and invoke **Gemini (Vertex AI)** in shared rooms.

This project implements the technical assessment using:

- **Frontend**: React 18 + TypeScript, Vite, Firebase Auth, Firestore
- **Backend**: FastAPI (Python), running on Cloud Run, calling **Vertex AI Gemini**
- **Infra**: Firebase Auth, Firestore, Firebase Hosting, Cloud Run, Vertex AI


## Live Demo & Credentials

- **Live URL**: `https://doctustech-489510.web.app`  
- **Backend base URL** (Cloud Run): `https://teamchat-backend-618792548667.us-central1.run.app/`

### Test Organizations & Users

| Org Slug | Email              | Password      | Role  |
|---------:|--------------------|---------------|-------|
| `acme`   | `sarah@acme.com`   | `Summit@2026`  | admin |
| `acme`   | `mike@acme.com`    | `Summit@2026`  | member|
| `acme`   | `lisa@acme.com`    | `Summit@2026`  | member|
| `globex` | `alice@globex.com` | `Summit@2026`  | admin |
| `globex` | `bob@globex.com`   | `Summit@2026`  | member|
| `globex` | `eve@globex.com`   | `Summit@2026`  | member|

Login flow:

1. On the login page, enter **Organization Slug** (`acme` or `globex`).
2. Enter one of the test user credentials.
3. Sign in and you will be scoped to that organization’s rooms and messages.

## Architecture Overview

At a high level:

- The **React frontend** uses **Firebase Auth** for login and **Firestore** for:
  - Organizations, rooms, messages
  - Presence (who is online) and typing indicators
- The **FastAPI backend**:
  - Verifies Firebase ID tokens
  - Enforces that users only access their own organization and rooms
  - Reads recent Firestore messages to build an attributed conversation context
  - Calls **Vertex AI Gemini** with streaming enabled and writes the streaming reply into Firestore
- **Firestore security rules** and **custom claims (`orgSlug`)** enforce strong tenant isolation.


### Data Model (Firestore)

- `organizations/{orgSlug}`
  - `slug`, `name`
  - `users/{userId}`: `email`, `displayName`, `role`
  - `rooms/{roomId}`: `name`, `description`, `memberIds[]`
    - `messages/{messageId}`: `senderId`, `senderName`, `senderRole`, `type`, `content`, `createdAt`
    - `typing/{userId}`: `userId`, `displayName`, `isTyping`, `updatedAt`
  - `presence/{userId}`: `userId`, `displayName`, `lastSeen`, `currentRoomId`

**Tenant isolation**:

- Each authenticated user has a custom claim: `orgSlug`.
- Frontend always scopes paths to `organizations/{orgSlug}/...`.
- Firestore rules allow access **only** when `request.auth.token.orgSlug == org`.
- Backend validates:
  - Token is valid.
  - `orgSlug` in token matches `{org}` in URL.
  - User is a member of the room (`memberIds`).

## Features Implemented

- **Multi-tenancy**
  - Organizations identified by slug (`acme`, `globex`).
  - Users belong to exactly one organization via `orgSlug` custom claim.
  - All Firestore reads/writes and backend calls are scoped by org slug.

- **Real-time collaborative chat**
  - Room list and message list backed by Firestore real-time listeners.
  - **Presence**: periodic `presence` updates per user, with online list per org.
  - **Typing indicators**: per-room `typing` subcollection.

- **Gemini AI integration**
  - Users mention `@Gemini` or `@AI` in a message to invoke the AI.
  - FastAPI endpoint:
    - Fetches last N messages with full user attribution.
    - Builds a conversation transcript and system prompt.
    - Streams Gemini response and writes into `messages` as an AI message.
  - All clients in the room see the AI message streaming in real time.

- **Security**
  - Firebase Auth (email/password).
  - Custom claims (`orgSlug`) on users.
  - Firestore rules enforcing org boundaries and per-user writes for presence/typing.
  - Backend double-checks org + room membership before calling Gemini.

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- GCP project with:
  - Enabled **Vertex AI** and **Cloud Firestore** APIs
- Firebase project connected to the same GCP project:
  - **Email/password** sign-in enabled
  - **Firestore** in production mode

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Configure environment in `backend/.env`:

```bash
GOOGLE_CLOUD_PROJECT=doctustech-489510
FIREBASE_PROJECT_ID=doctustech-489510
GEMINI_LOCATION=us-central1
GEMINI_MODEL=gemini-1.5-pro
```

Run the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend (React)

```bash
cd frontend
npm install
```

Configure `frontend/.env`:

```bash
VITE_FIREBASE_API_KEY=<from Firebase config>
VITE_FIREBASE_AUTH_DOMAIN=<from Firebase config>
VITE_FIREBASE_PROJECT_ID=doctustech-489510
VITE_API_BASE_URL=http://localhost:8001
```

Run the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Seeding Test Data

There is a Python script to pre-seed:

- 2 organizations: `acme`, `globex`
- 3 users per organization
- Sample rooms and messages

Run:

```bash
cd backend
python scripts/seed_firestore.py
```
The script:

- Links existing Firebase Auth users by email.
- Writes org/room/message documents.
- Adds `orgSlug` custom claims to each user.


## Test Credentials Document

See `TEST_CREDENTIALS.md` in the project root for a concise list of test users and instructions to verify tenant isolation.

# TeamChat
