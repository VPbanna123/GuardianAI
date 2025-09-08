from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
from dotenv import load_dotenv
from datetime import datetime

from models import ChatMessage, ChatResponse
from personas import get_persona_prompt, get_all_personas
from rate_limiter import RateLimiter
from rate_limiter import supabase


load_dotenv()

app = FastAPI(title="Persona Chatbot API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")


PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")

class SessionManager:
    @staticmethod
    def get_or_create_session(user_id: str, persona: str) -> str:
        """Get active session or create new one for user and persona"""
        try:
            # Check for active session with this persona
            active_session = supabase.table('chat_sessions').select('*').eq('user_id', user_id).eq('persona', persona).eq('is_active', True).execute()
            
            if active_session.data:
                # Update last activity
                session_id = active_session.data[0]['id']
                supabase.table('chat_sessions').update({
                    'last_activity': datetime.now().isoformat()
                }).eq('id', session_id).execute()
                return session_id
            else:
                # Deactivate any other active sessions for this user
                supabase.table('chat_sessions').update({
                    'is_active': False
                }).eq('user_id', user_id).eq('is_active', True).execute()
                
                # Create new session
                new_session = {
                    'user_id': user_id,
                    'persona': persona,
                    'is_active': True
                }
                result = supabase.table('chat_sessions').insert(new_session).execute()
                return result.data[0]['id']
        except Exception as e:
            print(f"Session manager error: {e}")
            raise HTTPException(status_code=500, detail="Session management failed")
    
    @staticmethod
    def get_user_sessions(user_id: str):
        """Get all sessions for a user"""
        try:
            sessions = supabase.table('chat_sessions').select('*').eq('user_id', user_id).order('last_activity', desc=True).execute()
            return sessions.data
        except Exception as e:
            print(f"Error getting user sessions: {e}")
            return []

@app.get("/")
async def read_root():
    return {"message": "Persona Chatbot API is running"}

@app.get("/personas")
async def get_personas():
    return get_all_personas()

@app.post("/chat", response_model=ChatResponse)
async def chat_with_persona(chat_message: ChatMessage):
    # Rate limiting check
    can_proceed, remaining = RateLimiter.check_and_update_user_limits(chat_message.username)
    
    if not can_proceed:
        raise HTTPException(status_code=429, detail="Daily message limit exceeded")
    
    try:
        # Get user ID
        user_data = supabase.table('users').select('id').eq('username', chat_message.username).execute()
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = user_data.data[0]['id']
        
        # Get or create session
        session_id = SessionManager.get_or_create_session(user_id, chat_message.persona)
        
        # Get persona system prompt
        system_prompt = get_persona_prompt(chat_message.persona)
        if not system_prompt:
            raise HTTPException(status_code=400, detail="Invalid persona")
        
        # Prepare Perplexity API request
        headers = {
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "sonar",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": chat_message.message}
            ],
            "max_tokens": 85,
            "temperature": 0.8,
        }
        
        # Make API call to Perplexity
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get response from AI")
        
        ai_response = response.json()
        bot_message = ai_response['choices'][0]['message']['content']
        token_count = ai_response.get('usage', {}).get('total_tokens', 0)
        
        # Store conversation in database with session_id
        conversation_data = {
            'user_id': user_id,
            'session_id': session_id,
            'persona': chat_message.persona,
            'message': chat_message.message,
            'response': bot_message,
            'token_count': token_count
        }
        supabase.table('conversations').insert(conversation_data).execute()
        
        return ChatResponse(
            response=bot_message,
            persona=chat_message.persona,
            token_count=token_count,
            remaining_messages=remaining,
            session_id=session_id
        )
        
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/persona/select")
async def select_persona(data: dict):
    """Endpoint to handle persona selection"""
    username = data.get('username')
    persona = data.get('persona')
    
    if not username or not persona:
        raise HTTPException(status_code=400, detail="Username and persona required")
    
    try:
        # Get user
        user_data = supabase.table('users').select('id').eq('username', username).execute()
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = user_data.data[0]['id']
        
        # Create/get session
        session_id = SessionManager.get_or_create_session(user_id, persona)
        
        return {
            "success": True,
            "session_id": session_id,
            "persona": persona,
            "message": f"Selected persona: {persona}"
        }
        
    except Exception as e:
        print(f"Persona selection error: {e}")
        raise HTTPException(status_code=500, detail="Failed to select persona")

@app.get("/user/{username}/stats")
async def get_user_stats(username: str):
    remaining = RateLimiter.get_remaining_messages(username)
    return {
        "remaining_messages": remaining,
        "daily_limit": RateLimiter.DAILY_MESSAGE_LIMIT
    }

@app.get("/user/{username}/sessions")
async def get_user_chat_sessions(username: str):
    """Get all chat sessions for a user"""
    try:
        user_data = supabase.table('users').select('id').eq('username', username).execute()
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = user_data.data[0]['id']
        sessions = SessionManager.get_user_sessions(user_id)
        
        return {
            "sessions": sessions,
            "total_sessions": len(sessions)
        }
    except Exception as e:
        print(f"Error getting sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get sessions")

@app.get("/session/{session_id}/conversations")
async def get_session_conversations(session_id: str):
    """Get all conversations for a specific session"""
    try:
        conversations = supabase.table('conversations').select('*').eq('session_id', session_id).order('created_at').execute()
        return {
            "conversations": conversations.data,
            "total_messages": len(conversations.data)
        }
    except Exception as e:
        print(f"Error getting conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to get conversations")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
