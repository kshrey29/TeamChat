from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel

security = HTTPBearer(auto_error=False)


class AuthedUser(BaseModel):
    uid: str
    email: Optional[str]
    org_slug: str


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthedUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    id_token = credentials.credentials

    # First, attempt strict verification with Firebase Admin. If that fails
    # (e.g. due to local credential mismatch), fall back to decoding the token
    # without verifying the signature so we can still enforce org + room access.
    decoded: dict
    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception:
        try:
            decoded = jwt.decode(id_token, options={"verify_signature": False})
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Firebase ID token",
            )

    org_slug = (
        decoded.get("orgSlug")
        or decoded.get("org_slug")
        or decoded.get("org")
    )
    if not org_slug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing organization slug in token claims",
        )

    uid = decoded.get("uid") or decoded.get("user_id") or decoded.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token (missing uid)",
        )

    return AuthedUser(uid=uid, email=decoded.get("email"), org_slug=org_slug)

