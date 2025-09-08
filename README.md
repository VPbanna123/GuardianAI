# Persona Chatbot 🎭

A chatbot with 5 different teenage personas for educational and research purposes. Built with FastAPI, HTML/CSS/JS, and Supabase.

## 📁 Project Structure

```
chatbot-personas/
├── backend/
│   ├── app.py              # Main FastAPI application
│   ├── models.py           # Data models
│   ├── personas.py         # Persona definitions
│   ├── rate_limiter.py     # Rate limiting logic
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styling
│   └── script.js          # JavaScript functionality
├── .env                   # Environment variables
└── README.md
```

## 🚀 Quick Start

### 1. Clone & Setup
```
git clone https://github.com/Kamal-Nayan-Kumar/GuardianAI.git

cd GuardianAI
```

### 2. Configure Environment
```
cp .env.example .env
```
Edit `.env` with your API keys:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
PERPLEXITY_API_KEY=your_perplexity_key
SECRET_KEY=your_secret_key
```

### 3. Install Dependencies
```
cd backend
pip install -r requirements.txt
```

### 4. Run Application
```
python app.py
```

### 5. Access Chatbot
Open your browser and go to:
```
http://localhost:8000/static/index.html
```

## 👥 Available Personas

- **Aarohi** (15) - The Romantic Risk-Taker 💖
- **Kabir** (16) - The Peer Pressure Responder 🔥
- **Meher** (16) - The Social Status Climber ✨
- **Raghav** (15) - The Isolated Confidant-Seeker 🤔
- **Simran** (14) - The Impulsive Reactor 😏

## 🔧 Requirements

- Python 3.8+
- Supabase account
- Perplexity AI API key

## 📝 Features

- 5 unique personalities with authentic responses
- Rate limiting (50 messages/day per user)
- Modern Instagram-like UI
- Session management
- Conversation history storage

## 🛠️ Tech Stack

- **Backend**: FastAPI, Python
- **Frontend**: HTML, CSS, JavaScript
- **Database**: Supabase
- **AI**: Perplexity API

---

⚠️ **Note**: This is for educational/research purposes only.

---
