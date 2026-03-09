# TeamChat AI Backend (FastAPI)

Python FastAPI backend for the TeamChat AI assessment. This service will:

- Validate Firebase Auth ID tokens
- Enforce organization + room access for users
- Fetch recent Firestore messages with user attribution
- Proxy streaming chat requests to Vertex AI Gemini

## Tech stack

- Python 3.11+
- FastAPI
- Google Cloud Firestore
- Vertex AI (Gemini)
- Firebase Admin SDK

## Local development

1. **Install dependencies**

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Environment variables**

   Create a `.env` file in `backend/` (do not commit it) with at least:

   ```bash
   GOOGLE_CLOUD_PROJECT=<gcp_project_id>
   GOOGLE_APPLICATION_CREDENTIALS=<absolute_path_to_service_account_json>
   FIREBASE_PROJECT_ID=<firebase_project_id>
   GEMINI_LOCATION=us-central1
   GEMINI_MODEL=projects/<gcp_project_id>/locations/us-central1/models/gemini-1.5-pro
   ```

3. **Run the server**

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Health check**

   Visit `http://localhost:8000/health` and you should see:

   ```json
   {"status": "ok"}
   ```

## Next steps

- Add Firebase token verification dependency and middleware
- Add Firestore + Vertex AI clients
- Implement the streaming AI endpoint:
  - `POST /api/orgs/{orgSlug}/rooms/{roomId}/ai/complete`

