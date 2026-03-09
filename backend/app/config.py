from dotenv import load_dotenv
from pydantic_settings import BaseSettings


# Ensure values from backend/.env are loaded into the environment
load_dotenv()


class Settings(BaseSettings):
    google_cloud_project: str
    firebase_project_id: str
    gemini_location: str = "us-central1"
    gemini_model: str = "gemini-1.5-pro"
    max_context_messages: int = 30

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()

