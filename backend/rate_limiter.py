import os
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import date, datetime
from models import User

# Load environment and create supabase client directly
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

class RateLimiter:
    DAILY_MESSAGE_LIMIT = 50
    TOKEN_LIMIT = 1000
    
    @staticmethod
    def check_and_update_user_limits(username: str) -> tuple[bool, int]:
        try:
            # Get or create user
            user_data = supabase.table('users').select('*').eq('username', username).execute()
            
            if not user_data.data:
                # Create new user
                new_user = {
                    'username': username,
                    'daily_message_count': 1,
                    'last_reset_date': str(date.today())
                }
                supabase.table('users').insert(new_user).execute()
                return True, RateLimiter.DAILY_MESSAGE_LIMIT - 1
            
            user = user_data.data[0]
            today = str(date.today())
            
            # Reset daily count if new day
            if user['last_reset_date'] != today:
                supabase.table('users').update({
                    'daily_message_count': 1,
                    'last_reset_date': today
                }).eq('username', username).execute()
                return True, RateLimiter.DAILY_MESSAGE_LIMIT - 1
            
            # Check if limit exceeded
            if user['daily_message_count'] >= RateLimiter.DAILY_MESSAGE_LIMIT:
                return False, 0
            
            # Increment count
            new_count = user['daily_message_count'] + 1
            supabase.table('users').update({
                'daily_message_count': new_count
            }).eq('username', username).execute()
            
            remaining = RateLimiter.DAILY_MESSAGE_LIMIT - new_count
            return True, remaining
            
        except Exception as e:
            print(f"Rate limiter error: {e}")
            return False, 0
    
    @staticmethod
    def get_remaining_messages(username: str) -> int:
        try:
            user_data = supabase.table('users').select('*').eq('username', username).execute()
            if not user_data.data:
                return RateLimiter.DAILY_MESSAGE_LIMIT
            
            user = user_data.data[0]
            today = str(date.today())
            
            if user['last_reset_date'] != today:
                return RateLimiter.DAILY_MESSAGE_LIMIT
            
            return max(0, RateLimiter.DAILY_MESSAGE_LIMIT - user['daily_message_count'])
        except:
            return 0
