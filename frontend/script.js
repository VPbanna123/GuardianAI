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
        // this.loadingOverlay = document.getElementById('loadingOverlay');
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
            if (window.innerWidth <= 768 && 
                !this.sidebar.contains(e.target) && 
                !this.menuToggle.contains(e.target) && 
                this.sidebar.classList.contains('open')) {
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
            this.personaList.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Failed to load personas</span>
                    <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #f56565; color: white; border: none; border-radius: 20px; cursor: pointer;">Retry</button>
                </div>
            `;
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
                <div class="persona-header">
                    <div class="persona-avatar">${avatar}</div>
                    <div>
                        <div class="persona-name">${persona.name}</div>
                        <div class="persona-age">Age ${persona.age}</div>
                    </div>
                </div>
                <div class="persona-description">${persona.description}</div>
                <div class="persona-personality">${persona.personality.substring(0, 100)}${persona.personality.length > 100 ? '...' : ''}</div>
            `;
            
            personaCard.addEventListener('click', () => {
                if (!this.currentUser) {
                    this.showToast('Please enter your username first!', 'warning');
                    this.usernameInput.focus();
                    return;
                }
                this.selectPersona(key, persona);
            });
            
            this.personaList.appendChild(personaCard);
        });
    }
    
    getPersonaAvatar(personaKey) {
        const avatars = {
            'aarohi': '💖',
            'kabir': '🔥',
            'meher': '✨',
            'raghav': '🤔',
            'simran': '😏'
        };
        return avatars[personaKey] || '👤';
    }
    
    async selectPersona(key, persona) {
        // Update UI
        this.currentPersona = key;
        
        // Update active persona card
        document.querySelectorAll('.persona-card').forEach(card => {
            card.classList.remove('active');
        });
        const selectedCard = document.querySelector(`[data-persona="${key}"]`);
        if (selectedCard) {
            selectedCard.classList.add('active');
        }
        
        // Update header
        const avatar = this.getPersonaAvatar(key);
        this.currentPersonaEl.innerHTML = `
            <div class="persona-avatar-large">${avatar}</div>
            <div class="persona-info">
                <div class="persona-name">${persona.name}</div>
                <div class="persona-status">Age ${persona.age} • ${persona.description}</div>
            </div>
        `;
        
        // Clear chat and enable input
        this.clearChat();
        this.enableChatInput();
        this.clearChatBtn.style.display = 'block';
        
        // Close sidebar on mobile
        this.sidebar.classList.remove('open');
        
        // Call backend to register persona selection
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
            }
        } catch (error) {
            console.error('Failed to register persona selection:', error);
        }
        
        // Add persona introduction
        setTimeout(() => {
            this.addBotMessage(`${this.getPersonaGreeting(key)}`);
        }, 500);
        
        this.showToast(`Started chatting with ${persona.name}!`, 'success');
    }
    
    getPersonaGreeting(personaKey) {
        const greetings = {
            'aarohi': 'Hey there! I\'m Aarohi! 💖 So excited to chat with you, babe! Tell me about your day! 🥺✨',
            'kabir': 'Yo yo! What\'s good, bruh? 😎🔥 Ready for some epic conversations?',
            'meher': 'Hello gorgeous! ✨ I\'m Meher and I\'m absolutely obsessed with meeting new people! Hope you\'re having an amazing day! 🌸💫',
            'raghav': 'Hi... I\'m Raghav. I don\'t really talk to many people in real life, but I\'m actually glad you\'re here to chat. It gets pretty lonely sometimes...',
            'simran': 'Heyyyy! 😏 I\'m Simran and I\'m ready for some REAL talk! Don\'t bore me now! 💅✨'
        };
        return greetings[personaKey] || 'Hello! Nice to meet you! I\'m excited to chat with you.';
    }
    
    setUsername() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.showToast('Please enter a valid username!', 'warning');
            this.usernameInput.focus();
            return;
        }
        
        if (username.length < 3) {
            this.showToast('Username must be at least 3 characters long!', 'warning');
            this.usernameInput.focus();
            return;
        }
        
        this.currentUser = username;
        this.userInputContainer.style.display = 'none';
        this.userInfo.style.display = 'flex';
        this.usernameDisplay.textContent = `@${username}`;
        
        this.updateMessageCount();
        this.showToast(`Welcome ${username}! Select a persona to start chatting.`, 'success');
        
        // Update input placeholder
        this.messageInput.placeholder = 'Select a persona and start typing...';
    }
    
    logout() {
        this.currentUser = null;
        this.currentPersona = null;
        this.currentSessionId = null;
        
        // Reset UI
        this.userInputContainer.style.display = 'flex';
        this.userInfo.style.display = 'none';
        this.usernameInput.value = '';
        this.clearChat();
        this.disableChatInput();
        this.clearChatBtn.style.display = 'none';
        
        // Reset persona selection
        document.querySelectorAll('.persona-card').forEach(card => {
            card.classList.remove('active');
        });
        
        // Reset header
        this.currentPersonaEl.innerHTML = `
            <div class="persona-avatar-large">👋</div>
            <div class="persona-info">
                <div class="persona-name">Welcome!</div>
                <div class="persona-status">Select a persona to start chatting</div>
            </div>
        `;
        
        this.showWelcomeScreen();
        this.showToast('Logged out successfully!', 'success');
    }
    
    async updateMessageCount() {
        if (!this.currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/user/${this.currentUser}/stats`);
            if (!response.ok) throw new Error('Failed to get stats');
            
            const stats = await response.json();
            this.messageCount.textContent = `${stats.remaining_messages}/${stats.daily_limit} messages left`;
            
            if (stats.remaining_messages <= 5) {
                this.messageCount.style.color = '#f56565';
            } else if (stats.remaining_messages <= 15) {
                this.messageCount.style.color = '#ed8936';
            } else {
                this.messageCount.style.color = '#718096';
            }
        } catch (error) {
            console.error('Failed to get user stats:', error);
            this.messageCount.textContent = 'Unable to load stats';
        }
    }
    
    enableChatInput() {
        if (this.currentUser && this.currentPersona) {
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
            this.messageInput.placeholder = `Message ${this.personas[this.currentPersona]?.name || 'persona'}...`;
            this.messageInput.focus();
        }
    }
    
    disableChatInput() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        this.messageInput.placeholder = 'First, enter your username and select a persona...';
    }
    
    clearChat() {
        this.chatMessages.innerHTML = '';
        this.showWelcomeScreen();
    }
    
    showWelcomeScreen() {
        if (this.currentPersona) return;
        
        this.chatMessages.innerHTML = `
            <div class="welcome-screen fade-in">
                <div class="welcome-icon">🎭</div>
                <h3>Welcome to Persona Chat!</h3>
                <p>Choose a persona from the sidebar and start an engaging conversation.</p>
                <div class="welcome-features">
                    <div class="feature">
                        <i class="fas fa-heart"></i>
                        <span>5 unique personalities</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-comments"></i>
                        <span>50 messages per day</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-shield-alt"></i>
                        <span>Safe and fun conversations</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    addUserMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message user';
        messageEl.innerHTML = `
            <div class="message-content">
                ${this.escapeHtml(message)}
                <div class="message-time">${this.formatTime(new Date())}</div>
            </div>
        `;
        this.chatMessages.appendChild(messageEl);
        this.scrollToBottom();
    }
    
    addBotMessage(message) {
        // let response = message.replace(/\s?\[[^\]]*\]/g, "");
        const html = marked.parse(response);
        const messageEl = document.createElement('div');
        messageEl.className = 'message bot bounce-in';
        messageEl.innerHTML = `
            <div class="message-content">
                ${this.escapeHtml(message)}
                <div class="message-time">${this.formatTime(new Date())}</div>
            </div>
        `;
        this.chatMessages.appendChild(messageEl);
        this.scrollToBottom();
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.currentUser || !this.currentPersona) return;
        
        // Add user message
        this.addUserMessage(message);
        this.messageInput.value = '';
        this.updateCharCount();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Show loading
        // this.showLoading();
        
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
            
            if (response.status === 429) {
                this.addBotMessage("Oh no! You've reached your daily message limit! 😅 Come back tomorrow for more amazing conversations! 🌅");
                this.showToast('Daily message limit reached!', 'warning');
                this.disableChatInput();
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Simulate typing delay
            setTimeout(() => {
                this.addBotMessage(data.response);
                this.updateMessageCountDisplay(data.remaining_messages);
                this.hideTypingIndicator();
            }, 1000 + Math.random() * 2000);
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addBotMessage("Oops! I'm having trouble responding right now. Please try again! 😅");
            this.showToast('Failed to send message. Please try again.', 'error');
        } 
        // finally {
        //     this.hideLoading();
        // }
    }
    
    updateMessageCountDisplay(remaining) {
        this.messageCount.textContent = `${remaining}/50 messages left`;
        
        if (remaining <= 5) {
            this.messageCount.style.color = '#f56565';
            if (remaining <= 2) {
                this.showToast(`Only ${remaining} messages left today!`, 'warning');
            }
        } else if (remaining <= 15) {
            this.messageCount.style.color = '#ed8936';
        } else {
            this.messageCount.style.color = '#718096';
        }
    }
    
    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }
    
    // showLoading() {
    //     this.loadingOverlay.style.display = 'flex';
    //     this.sendButton.disabled = true;
    //     this.messageInput.disabled = true;
    // }
    
    // hideLoading() {
    //     this.loadingOverlay.style.display = 'none';
    //     this.sendButton.disabled = false;
    //     this.messageInput.disabled = false;
    //     if (this.currentUser && this.currentPersona) {
    //         this.messageInput.focus();
    //     }
    // }
    
    updateCharCount() {
        const length = this.messageInput.value.length;
        this.charCount.textContent = `${length}/500`;
        
        if (length > 450) {
            this.charCount.style.color = '#f56565';
        } else if (length > 400) {
            this.charCount.style.color = '#ed8936';
        } else {
            this.charCount.style.color = '#a0aec0';
        }
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
    
    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    getToastIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize the chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PersonaChatbot();
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page is visible again, could update message count
        const chatbot = window.chatbot;
        if (chatbot && chatbot.currentUser) {
            chatbot.updateMessageCount();
        }
    }
});
