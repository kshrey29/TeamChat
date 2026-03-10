from datetime import datetime, timezone
import logging
import sys
import time
from typing import AsyncGenerator, List, Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.responses import StreamingResponse
from google.cloud import firestore
from pydantic import BaseModel

from .auth import AuthedUser, get_current_user
from .clients import get_firestore_client, get_gemini_model
from .config import settings

router = APIRouter(prefix="/api")


class ChatCompletionRequest(BaseModel):
    max_messages: Optional[int] = None


def _format_timestamp(ts: firestore.SERVER_TIMESTAMP) -> str:
    if hasattr(ts, "to_datetime"):
        dt = ts.to_datetime()
    elif isinstance(ts, datetime):
        dt = ts
    else:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%H:%M")


@router.post(
    "/orgs/{org_slug}/rooms/{room_id}/ai/complete",
    response_class=StreamingResponse,
)
async def complete_chat_with_ai(
    payload: ChatCompletionRequest,
    org_slug: str = Path(..., description="Organization slug"),
    room_id: str = Path(..., description="Room ID"),
    user: AuthedUser = Depends(get_current_user),
) -> StreamingResponse:
    if user.org_slug != org_slug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    db = get_firestore_client()

    org_ref = db.collection("organizations").document(org_slug)
    room_ref = org_ref.collection("rooms").document(room_id)
    room_snapshot = room_ref.get()
    if not room_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    room_data = room_snapshot.to_dict() or {}
    member_ids = room_data.get("memberIds", [])
    if user.uid not in member_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of this room",
        )

    max_messages = payload.max_messages or settings.max_context_messages

    messages_query = (
        room_ref.collection("messages")
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(max_messages)
    )
    message_docs = list(messages_query.stream())
    message_docs.reverse()

    formatted_lines: List[str] = []
    last_sender_name = "Unknown"

    for doc in message_docs:
        data = doc.to_dict() or {}
        sender_name = data.get("senderName", "Unknown")
        created_at = data.get("createdAt")
        content = data.get("content", "")
        if not content:
            continue
        timestamp = _format_timestamp(created_at)
        formatted_lines.append(f"[{timestamp}] {sender_name}: {content}")
        last_sender_name = sender_name

    conversation_block = "\n".join(formatted_lines) if formatted_lines else "(No messages yet in this room.)"

    system_instructions = (
        "You are Gemini AI participating in a multi-user team chat. "
        "Multiple participants may speak, and you must keep track of who says what. "
        "Address users by name where appropriate. Be concise and helpful."
    )

    if formatted_lines:
        prompt = (
            f"{system_instructions}\n\n"
            f"[Conversation History]\n"
            f"{conversation_block}\n"
            f"---\n"
            f"Respond to the conversation. The last message is from {last_sender_name}."
        )
    else:
        prompt = (
            f"{system_instructions}\n\n"
            "This room has no message history yet. A user has just invoked you. "
            "Greet the team briefly and offer to help with anything they need."
        )

    model = get_gemini_model()

    messages_coll = room_ref.collection("messages")
    ai_message_ref = messages_coll.document()
    ai_message_ref.set(
        {
            "id": ai_message_ref.id,
            "senderId": "ai",
            "senderName": "Gemini AI",
            "senderRole": "system",
            "type": "ai",
            "content": "",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )

    def token_stream() -> AsyncGenerator[bytes, None]:
        content_so_far = ""
        max_retries = 3
        base_delay = 0.5

        for attempt in range(1, max_retries + 1):
            try:
                responses = model.generate_content(prompt, stream=True)
                for response in responses:
                    text_chunk = getattr(response, "text", None)
                    if not text_chunk:
                        continue
                    content_so_far += text_chunk
                    ai_message_ref.update({"content": content_so_far})
                    yield text_chunk.encode("utf-8")
                # Successful completion, exit after streaming all chunks
                return
            except Exception as exc:
                logger.exception(
                    "Gemini generate_content failed (attempt %s/%s): %s",
                    attempt,
                    max_retries,
                    exc,
                )
                
                if attempt < max_retries:
                    delay = base_delay * (2 ** (attempt - 1))
                    ai_message_ref.update(
                        {
                            "content": (
                                "Gemini temporarily failed, retrying..."
                            )
                        }
                    )
                    time.sleep(delay)
                    continue

                error_message = (
                    "Gemini is currently unavailable. Please try again later."
                )
                ai_message_ref.update({"content": error_message})
                yield f"\n[Error] {error_message}: {exc}".encode("utf-8")
                return

    return StreamingResponse(token_stream(), media_type="text/plain")

