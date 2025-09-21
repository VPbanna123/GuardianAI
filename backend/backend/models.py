from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class User(BaseModel):
    id: Optional[str] = None
    username: str
    daily_message_count: int = 0
    last_reset_date: Optional[str] = None

class ChatSession(BaseModel):
    id: Optional[str] = None
    user_id: str
    persona: str
    session_start: Optional[datetime] = None
    is_active: bool = True
    last_activity: Optional[datetime] = None

class ChatMessage(BaseModel):
    message: str
    persona: str
    username: str

class ChatResponse(BaseModel):
    response: str
    persona: str
    token_count: int
    remaining_messages: int
    session_id: str  # Add session_id to response

class Conversation(BaseModel):
    id: Optional[str] = None
    user_id: str
    session_id: Optional[str] = None  # Add session_id
    persona: str
    message: str
    response: str
    token_count: int
    created_at: Optional[datetime] = None


class User(BaseModel):
    id: Optional[str] = None
    username: str
    daily_message_count: int = 0
    last_reset_date: Optional[str] = None

class ChatMessage(BaseModel):
    message: str
    persona: str
    username: str

class ChatResponse(BaseModel):
    response: str
    persona: str
    token_count: int
    remaining_messages: int

class Conversation(BaseModel):
    id: Optional[str] = None
    user_id: str
    persona: str
    message: str
    response: str
    token_count: int
    created_at: Optional[datetime] = None
