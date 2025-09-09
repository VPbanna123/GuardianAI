const API_BASE_URL = 'https://guardian-ai-eight.vercel.app';

class PersonaChatbot {
    constructor() {
        this.currentPersona = null;
        this.currentUser = null;
        this.personas = {};
        this.currentSessionId = null;
        this.initializeElements();
        this.setupEventListeners();
        this.loadPersonas();
    }

    initializeElements() {
        // Sidebar elements
        this.sidebar = document.getElementById('sidebar');
        this.menuToggle = document.getElementById('menuToggle');
        this.closeSidebar = document.getElementById('closeSidebar');
        this.personaList = document.getElementById('personaList');

        // User elements
        this.usernameInput = document.getElementById('usernameInput');
        this.setUsernameBtn = document.getElementById('setUsername');
        this.userInfo = document.getElementById('userInfo');
        this.usernameDisplay = document.getElementById('usernameDisplay');
        this.messageCount = document.getElementById('messageCount');
        this.userInputContainer = document.getElementById('userInputContainer');
        this.logoutBtn = document.getElementById('logoutBtn');

        // Chat elements
        this.currentPersonaEl = document.getElementById('currentPersona');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendMessage');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.clearChatBtn = document.getElementById('clearChat');
        this.charCount = document.getElementById('charCount');
        this.toastContainer = document.getElementById('toastContainer');
    }

    setupEventListeners() {
        // Mobile menu
        this.menuToggle.addEventListener('click', () => {
            this.sidebar.classList.add('open');
        });
        
        this.closeSidebar.addEventListener('click', () => {
            this.sidebar.classList.remove('open');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && !this.sidebar.contains(e.target) && !this.menuToggle.contains(e.target) && this.sidebar.classList.contains('open')) {
                this.sidebar.classList.remove('open');
            }
        });

        // User setup
        this.setUsernameBtn.addEventListener('click', () => {
            this.setUsername();
        });
        
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.setUsername();
            }
        });
        
        this.logoutBtn.addEventListener('click', () => {
            this.logout();
        });

        // Chat functionality
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Character count
        this.messageInput.addEventListener('input', () => {
            this.updateCharCount();
        });

        // Clear chat
        this.clearChatBtn.addEventListener('click', () => {
            this.clearChat();
        });
    }

    async loadPersonas() {
        try {
            const response = await fetch(`${API_BASE_URL}/personas`);
            if (!response.ok) throw new Error('Failed to fetch personas');
            this.personas = await response.json();
            this.renderPersonas();
        } catch (error) {
            console.error('Failed to load personas:', error);
            this.showToast('Failed to load personas. Please refresh the page.', 'error');
            this.personaList.innerHTML = `<div class="error">Choose a persona from the sidebar and start an engaging conversation.</div>`;
        }
    }

    renderPersonas() {
        this.personaList.innerHTML = '';
        Object.entries(this.personas).forEach(([key, persona]) => {
            const personaCard = document.createElement('div');
            personaCard.className = 'persona-card';
            personaCard.dataset.persona = key;

            const avatar = this.getPersonaAvatar(key);
            personaCard.innerHTML = `
                <div class="persona-avatar">${avatar}</div>
                <div class="persona-info">
                    <h3>${persona.name}</h3>
                    <p class="persona-age">Age: ${persona.age}</p>
                    <p class="persona-desc">${persona.description}</p>
                    <p class="persona-personality">${persona.personality}</p>
                </div>
            `;
            
            personaCard.addEventListener('click', () => {
                this.selectPersona(key, persona);
            });
            
            this.personaList.appendChild(personaCard);
        });
    }

    async selectPersona(key, persona) {
        if (!this.currentUser) {
            this.showToast('Please set your username first!', 'error');
            return;
        }

        // Update UI
        this.currentPersona = key;
        this.currentPersonaEl.textContent = persona.name;

        // Update selected state
        document.querySelectorAll('.persona-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-persona="${key}"]`).classList.add('selected');

        // Call backend to register persona selection
        if (this.currentUser) {
            try {
                const response = await fetch(`${API_BASE_URL}/persona/select`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: this.currentUser,
                        persona: key
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.currentSessionId = data.session_id;
                    
                    // Clear chat and show welcome message
                    this.clearChat();
                    setTimeout(() => {
                        const welcomeMsg = `Hey ${this.currentUser}! 🎭 I'm ${persona.name}. ${persona.personality}`;
                        this.addBotMessage(welcomeMsg);
                    }, 800);
                }
            } catch (error) {
                console.error('Failed to register persona selection:', error);
            }
        }

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            this.sidebar.classList.remove('open');
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.currentPersona || !this.currentUser) return;

        // Add user message
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.updateCharCount();

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    persona: this.currentPersona,
                    username: this.currentUser
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Hide typing indicator
            this.hideTypingIndicator();

            // Add bot response with delay
            setTimeout(() => {
                this.addBotMessage(data.response);
            }, 500);

            // Update message count
            this.updateMessageCount();

        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.showToast('Failed to send message. Please try again.', 'error');
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.innerHTML = `
            <div class="message-content">${text}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addBotMessage(messageText) {
        this.addMessage(messageText, 'bot');
    }

    showTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'block';
        }
    }

    hideTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none';
        }
    }

    async updateMessageCount() {
        if (!this.currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/user/${this.currentUser}/stats`);
            if (!response.ok) throw new Error('Failed to get stats');
            
            const stats = await response.json();
            this.messageCount.textContent = `${stats.remaining_messages}/${stats.daily_limit} messages left`;
        } catch (error) {
            console.error('Failed to get user stats:', error);
        }
    }

    setUsername() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.showToast('Please enter a valid username!', 'error');
            return;
        }

        this.currentUser = username;
        this.usernameDisplay.textContent = username;
        
        // Toggle UI elements
        this.userInfo.style.display = 'block';
        this.userInputContainer.style.display = 'none';
        
        this.showToast(`Welcome, ${username}!`, 'success');
        this.updateMessageCount();
    }

    logout() {
        this.currentUser = null;
        this.currentPersona = null;
        this.currentSessionId = null;
        
        // Reset UI
        this.userInfo.style.display = 'none';
        this.userInputContainer.style.display = 'block';
        this.usernameInput.value = '';
        this.currentPersonaEl.textContent = 'Select a Persona';
        
        // Clear selected persona
        document.querySelectorAll('.persona-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        this.clearChat();
        this.showToast('Logged out successfully!', 'success');
    }

    clearChat() {
        this.chatMessages.innerHTML = '';
    }

    updateCharCount() {
        const count = this.messageInput.value.length;
        const maxCount = 1000;
        this.charCount.textContent = `${count}/${maxCount}`;
        
        if (count > maxCount * 0.9) {
            this.charCount.style.color = '#ff6b6b';
        } else {
            this.charCount.style.color = '#666';
        }
    }

    getPersonaAvatar(key) {
        const avatars = {
            'aarohi': '👧',
            'kabir': '👦',
            'meher': '💅',
            'raghav': '🤓',
            'simran': '😤'
        };
        return avatars[key] || '🤖';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// Initialize the chatbot
const chatbot = new PersonaChatbot();
