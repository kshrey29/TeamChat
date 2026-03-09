from typing import Optional

import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel

from .config import settings

_firestore_client: Optional[firestore.Client] = None
_gemini_model: Optional[GenerativeModel] = None


def init_firebase() -> None:
    if not firebase_admin._apps:
        # Use application default credentials, but explicitly bind to the
        # Firebase project ID so ID token verification matches the frontend.
        firebase_admin.initialize_app(
            options={
                "projectId": settings.firebase_project_id,
            }
        )


def get_firestore_client() -> firestore.Client:
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = firestore.Client(project=settings.google_cloud_project)
    return _firestore_client


def get_gemini_model() -> GenerativeModel:
    global _gemini_model
    if _gemini_model is None:
        vertexai.init(
            project=settings.google_cloud_project,
            location=settings.gemini_location,
        )
        _gemini_model = GenerativeModel(settings.gemini_model)
    return _gemini_model

