/**
 * Contact Host Messaging - Vanilla JavaScript Implementation
 * Standalone modal component for contacting property hosts
 * Integrates with Bubble.io database and workflows
 */

class ContactHostMessaging {
    constructor() {
        this.modal = null;
        this.overlay = null;
        this.currentView = 'contactForm';
        this.isOpen = false;
        this.currentListing = null;
        this.currentUser = null;
        this.isSubmitting = false;
        this.formData = {
            userName: '',
            subject: '',
            messageBody: '',
            email: ''
        };
        this.errors = {};

        this.init();
    }

    init() {
        // Create modal HTML structure
        this.createModalElements();
        // Attach event listeners
        this.attachEventListeners();
        console.log('✅ Contact Host Messaging initialized');
    }

    createModalElements() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'contact-host-overlay';
        this.overlay.style.display = 'none';

        // Create modal
        this.modal = document.createElement('div');
        this.modal.className = 'contact-host-modal';
        this.modal.innerHTML = `
            <button class="btn-close" aria-label="Close dialog">×</button>
            <div class="modal-content"></div>
        `;

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    attachEventListeners() {
        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Close button
        const closeBtn = this.modal.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => this.close());

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    open(listing, currentUser = null) {
        this.currentListing = listing;
        this.currentUser = currentUser;
        this.isOpen = true;
        this.currentView = 'contactForm';

        // Pre-fill form data
        this.formData = {
            userName: currentUser?.name || currentUser?.firstName || '',
            subject: listing.title || '',
            messageBody: '',
            email: currentUser?.email || ''
        };

        this.errors = {};

        // Show modal
        this.overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Render content
        this.render();

        console.log('📧 Opening contact modal for listing:', listing.id);
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
        document.body.style.overflow = '';
        this.currentView = 'contactForm';
        this.formData = {
            userName: '',
            subject: '',
            messageBody: '',
            email: ''
        };
        this.errors = {};
    }

    render() {
        const content = this.modal.querySelector('.modal-content');

        switch(this.currentView) {
            case 'contactForm':
                content.innerHTML = this.renderContactForm();
                this.attachFormListeners();
                break;
            case 'success':
                content.innerHTML = this.renderSuccessView();
                this.attachSuccessListeners();
                break;
            case 'requireSignup':
                content.innerHTML = this.renderRequireSignupView();
                this.attachSignupListeners();
                break;
        }
    }

    renderContactForm() {
        const isLoggedIn = !!this.currentUser;
        const hostName = this.currentListing?.host?.name || 'Host';

        return `
            <div class="contact-form-view">
                <div class="form-header">
                    <span class="icon" role="img" aria-label="messaging">💬</span>
                    <h2>Message ${this.escapeHtml(hostName)}</h2>
                    ${this.formData.subject ? `<p class="subject">${this.escapeHtml(this.formData.subject)}</p>` : ''}
                </div>

                ${isLoggedIn ? `
                    <p class="logged-in-status">
                        Logged in as ${this.escapeHtml(this.currentUser.firstName || this.currentUser.name)}
                    </p>
                ` : ''}

                <div class="form-group">
                    <label for="userName" class="sr-only">Your Name</label>
                    <input
                        id="userName"
                        type="text"
                        placeholder="Your name"
                        value="${this.escapeHtml(this.formData.userName)}"
                        class="${this.errors.userName ? 'error' : ''}"
                        ${isLoggedIn ? 'disabled' : ''}
                    />
                    ${this.errors.userName ? `<span class="error-text" role="alert">${this.errors.userName}</span>` : ''}
                </div>

                ${!isLoggedIn ? `
                    <div class="form-group">
                        <label for="email" class="sr-only">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="Email"
                            value="${this.escapeHtml(this.formData.email)}"
                            class="${this.errors.email ? 'error' : ''}"
                        />
                        ${this.errors.email ? `<span class="error-text" role="alert">${this.errors.email}</span>` : ''}
                        <a href="https://app.split.lease/signup-login" class="signup-link" target="_blank" rel="noopener noreferrer">
                            Sign Up to increase your chance of a host replying and to track messages inside Split Lease
                        </a>
                    </div>
                ` : ''}

                <div class="form-group">
                    <label for="messageBody" class="sr-only">Your Message</label>
                    <textarea
                        id="messageBody"
                        placeholder="Your message..."
                        rows="5"
                        class="${this.errors.messageBody ? 'error' : ''}"
                    >${this.escapeHtml(this.formData.messageBody)}</textarea>
                    ${this.errors.messageBody ? `<span class="error-text" role="alert">${this.errors.messageBody}</span>` : ''}
                </div>

                <button class="btn-primary btn-send" ${this.isSubmitting ? 'disabled' : ''}>
                    ${this.isSubmitting ? 'Sending...' : 'Send message'}
                </button>

                ${this.errors.submit ? `<div class="error-banner" role="alert">${this.errors.submit}</div>` : ''}
            </div>
        `;
    }

    renderSuccessView() {
        return `
            <div class="success-view">
                <div class="success-icon" role="img" aria-label="success">✓</div>
                <h3>It's on its way!!</h3>
                <p>Your message has been sent.</p>
                <button class="btn-primary">Done</button>
            </div>
        `;
    }

    renderRequireSignupView() {
        return `
            <div class="require-signup-view">
                <p>You must create an account and be logged in to send private messages</p>
                <button class="btn-primary">Sign Up</button>
                <button class="btn-secondary">Go Back</button>
            </div>
        `;
    }

    attachFormListeners() {
        const userName = document.getElementById('userName');
        const email = document.getElementById('email');
        const messageBody = document.getElementById('messageBody');
        const sendBtn = this.modal.querySelector('.btn-send');

        if (userName) {
            userName.addEventListener('input', (e) => {
                this.formData.userName = e.target.value;
                this.clearError('userName');
            });
        }

        if (email) {
            email.addEventListener('input', (e) => {
                this.formData.email = e.target.value;
                this.clearError('email');
            });
        }

        if (messageBody) {
            messageBody.addEventListener('input', (e) => {
                this.formData.messageBody = e.target.value;
                this.clearError('messageBody');
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSendMessage());
        }
    }

    attachSuccessListeners() {
        const doneBtn = this.modal.querySelector('.btn-primary');
        if (doneBtn) {
            doneBtn.addEventListener('click', () => this.close());
        }
    }

    attachSignupListeners() {
        const signupBtn = this.modal.querySelector('.btn-primary');
        const goBackBtn = this.modal.querySelector('.btn-secondary');

        if (signupBtn) {
            signupBtn.addEventListener('click', () => {
                window.location.href = 'https://app.split.lease/signup-login';
            });
        }

        if (goBackBtn) {
            goBackBtn.addEventListener('click', () => {
                this.currentView = 'contactForm';
                this.render();
            });
        }
    }

    clearError(field) {
        if (this.errors[field]) {
            delete this.errors[field];
            this.render();
        }
    }

    validateForm() {
        const newErrors = {};
        const isLoggedIn = !!this.currentUser;

        if (!this.formData.userName.trim()) {
            newErrors.userName = 'Name is required';
        }

        if (!this.formData.messageBody.trim()) {
            newErrors.messageBody = 'Message is required';
        } else if (this.formData.messageBody.trim().length < 10) {
            newErrors.messageBody = 'Message must be at least 10 characters';
        }

        if (!isLoggedIn && !this.formData.email.trim()) {
            newErrors.email = 'Email is required for guest users';
        } else if (!isLoggedIn && this.formData.email.trim() && !this.isValidEmail(this.formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        this.errors = newErrors;
        return Object.keys(newErrors).length === 0;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async handleSendMessage() {
        if (!this.validateForm()) {
            this.render();
            return;
        }

        this.isSubmitting = true;
        this.errors = {};
        this.render();

        try {
            console.log('📤 Sending message to Bubble API...');
            console.log('Listing ID:', this.currentListing.id);

            // Try multiple fields to find host ID
            const hostId = this.currentListing.host?.id ||
                          this.currentListing['Created By'] ||
                          this.currentListing.created_by ||
                          this.currentListing.host_id ||
                          'unknown-host';

            console.log('Host ID:', hostId);
            console.log('Full listing object:', this.currentListing);

            const response = await this.sendMessageToBubble({
                listingId: this.currentListing.id,
                hostId: hostId,
                senderName: this.formData.userName,
                senderEmail: this.formData.email,
                subject: this.formData.subject,
                message: this.formData.messageBody,
                userId: this.currentUser?.id || null,
                timestamp: new Date().toISOString()
            });

            if (response.success) {
                console.log('✅ Message sent successfully');
                this.currentView = 'success';
                this.render();
            } else {
                this.errors.submit = response.message || 'Failed to send message. Please try again.';
                this.render();
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            this.errors.submit = 'Network error. Please check your connection and try again.';
            this.render();
        } finally {
            this.isSubmitting = false;
        }
    }

    async sendMessageToBubble(messageData) {
        // Validate configuration
        if (!window.ENV?.BUBBLE_MESSAGING_ENDPOINT) {
            console.error('❌ Bubble messaging endpoint not configured');
            throw new Error('Messaging service not configured. Please contact support.');
        }

        if (!window.ENV?.BUBBLE_API_KEY) {
            console.error('❌ Bubble API key not configured');
            throw new Error('Messaging service authentication missing. Please contact support.');
        }

        // Real API call
        try {
            // Use configurable endpoint URL from ENV, with fallback to default
            const bubbleApiUrl = window.ENV.BUBBLE_MESSAGING_ENDPOINT ||
                                'https://splitlease.com/version-test/api/1.1/wf/send-message';

            console.log('📡 Calling Bubble workflow:', bubbleApiUrl);

            const payload = {
                listing_unique_id: messageData.listingId,
                message_body: messageData.message,
                sender_email: messageData.senderEmail,
                sender_name: messageData.senderName
            };

            console.log('📦 Payload:', payload);

            const response = await fetch(bubbleApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.ENV.BUBBLE_API_KEY}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Bubble API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Bubble API response:', data);

            return {
                success: true,
                messageId: data.message_id || 'unknown',
                timestamp: data.timestamp || new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Bubble API call failed:', error);

            // Check if it's a CORS error
            if (error.message && error.message.includes('Failed to fetch')) {
                console.error('🚫 CORS error detected. The Bubble workflow needs CORS configuration.');
                console.error('📋 To fix: Enable CORS in Bubble Settings → API → Allow requests from: https://splitlease.app');
                return {
                    success: false,
                    message: 'Unable to connect to messaging service. Please contact support.'
                };
            }

            return {
                success: false,
                message: error.message || 'Failed to send message'
            };
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }
}

// Initialize global instance
window.contactHostMessaging = null;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.contactHostMessaging = new ContactHostMessaging();
    });
} else {
    window.contactHostMessaging = new ContactHostMessaging();
}

console.log('📦 Contact Host Messaging module loaded');
