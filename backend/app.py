from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from datetime import datetime
import google.generativeai as genai
from models import ChatMessage, ChatResponse
from personas import get_persona_prompt, get_all_personas
from rate_limiter import RateLimiter
from rate_limiter import supabase
import json
import asyncio


load_dotenv()

# Configure the Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")
genai.configure(api_key=GEMINI_API_KEY)

# Define the Gemini model to use
GEMINI_MODEL = "gemini-2.5-flash"

app = FastAPI(title="Persona Chatbot API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://guardian-ai-jtya.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


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
    
    @staticmethod
    def get_session_history(session_id: str):
        """Get the conversation history for a session"""
        try:
            conversations = supabase.table('conversations').select('message, response').eq('session_id', session_id).order('created_at').execute()
            history = []
            for conv in conversations.data:
                history.append({"role": "user", "parts": [conv['message']]})
                history.append({"role": "model", "parts": [conv['response']]})
            return history
        except Exception as e:
            print(f"Error getting session history: {e}")
            return []


@app.get("/")
async def read_root():
    return {"message": "Persona Chatbot API is running"}

@app.get("/personas")
async def get_personas():
    return get_all_personas()

# This is the updated chat endpoint
@app.post("/chat")
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
        
        # Get persona system prompt and session history
        system_prompt = get_persona_prompt(chat_message.persona)
        if not system_prompt:
            raise HTTPException(status_code=400, detail="Invalid persona")

        # Get conversation history for the current session
        chat_history = SessionManager.get_session_history(session_id)
        
        # Initialize a Gemini model with the system prompt
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=system_prompt,
        )

        # Start a chat session with the existing history
        chat_session = model.start_chat(history=chat_history)
        
        # Stream the response from the Gemini API
        response_stream = await chat_session.send_message_async(chat_message.message, stream=True)
        
        async def stream_response():
            full_response_text = ""
            for chunk in response_stream:
                chunk_text = chunk.text
                full_response_text += chunk_text
                yield f"data: {json.dumps({'response': chunk_text})}\n\n"

            # After streaming is complete, get token count
            token_count_response = await genai.get_model(GEMINI_MODEL).count_tokens_async(
                chat_session.history + [{"role": "user", "parts": [chat_message.message]}]
            )
            token_count = token_count_response.total_tokens

            # Store conversation in the database
            conversation_data = {
                'user_id': user_id,
                'session_id': session_id,
                'persona': chat_message.persona,
                'message': chat_message.message,
                'response': full_response_text,
                'token_count': token_count
            }
            supabase.table('conversations').insert(conversation_data).execute()

            # Send a final message with the full response details
            final_data = {
                "response": full_response_text,
                "persona": chat_message.persona,
                "token_count": token_count,
                "remaining_messages": remaining,
                "session_id": session_id
            }
            yield f"data: {json.dumps(final_data)}\n\n"

        return Response(stream_response(), media_type="text/event-stream")

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