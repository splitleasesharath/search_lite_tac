// AI Signup Modal Component for Search Lite
// Integrates with Bubble.io workflow

(function() {
    'use strict';

    // Lottie URLs (from window.ENV set by config.js)
    const HEADER_ICON_LOTTIE_URL = window.ENV?.HEADER_ICON_LOTTIE_URL || 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1760473171600x280130752685858750/atom%20animation.json';
    const PARSING_LOTTIE_URL = window.ENV?.PARSING_LOTTIE_URL || 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1722533720265x199451206376484160/Animation%20-%201722533570126.json';
    const LOADING_LOTTIE_URL = window.ENV?.LOADING_LOTTIE_URL || 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1720724605167x733559911663532000/Animation%20-%201720724343172.lottie';
    const SUCCESS_LOTTIE_URL = window.ENV?.SUCCESS_LOTTIE_URL || 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1745939792891x394981453861459140/Report.json';

    // Bubble API Configuration (from window.ENV set by config.js)
    const BUBBLE_WORKFLOW_URL = window.ENV?.AI_SIGNUP_WORKFLOW_URL;
    const BUBBLE_API_KEY = window.ENV?.AI_SIGNUP_BUBBLE_KEY;

    // Validate configuration
    if (!BUBBLE_WORKFLOW_URL || !BUBBLE_API_KEY) {
        console.error('❌ AI Signup credentials missing from config');
        console.error('Required: window.ENV.AI_SIGNUP_WORKFLOW_URL and window.ENV.AI_SIGNUP_BUBBLE_KEY');
    }

    // Modal state
    let modalState = {
        isOpen: false,
        section: 'freeform',
        formData: {},
        lottieInstances: {}
    };

    // Utility functions for email/phone extraction
    function extractEmail(text) {
        if (!text) return null;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+[.,][a-zA-Z]{2,}/;
        const match = text.match(emailRegex);
        return match ? match[0] : null;
    }

    function extractPhone(text) {
        if (!text) return null;
        const completePhoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
        const completeMatch = text.match(completePhoneRegex);
        if (completeMatch) return completeMatch[0];
        const partialPhoneRegex = /\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{0,4}|\b\d{3,}\b/;
        const partialMatch = text.match(partialPhoneRegex);
        return partialMatch ? partialMatch[0] : null;
    }

    function autoCorrectEmail(email) {
        if (!email) return email;
        const typoMap = {
            'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail,com': 'gmail.com',
            'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo,com': 'yahoo.com',
            'hotmial.com': 'hotmail.com', 'hotmail,com': 'hotmail.com',
            'outlok.com': 'outlook.com', 'outlook,com': 'outlook.com',
            'icoud.com': 'icloud.com', 'icloud,com': 'icloud.com',
        };
        const [localPart, domain] = email.split('@');
        if (!domain) return email;
        const fixedDomain = domain.toLowerCase().replace(',', '.');
        const correctedDomain = typoMap[fixedDomain] || fixedDomain;
        return `${localPart}@${correctedDomain}`;
    }

    function checkEmailCertainty(email) {
        if (!email) return 'uncertain';
        const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        if (commonDomains.includes(domain)) return 'certain';
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email) ? 'certain' : 'uncertain';
    }

    function getButtonText() {
        if (modalState.section === 'freeform') {
            const extractedEmail = extractEmail(modalState.formData.marketResearchText || '');
            const extractedPhone = extractPhone(modalState.formData.marketResearchText || '');
            const correctedEmail = extractedEmail ? autoCorrectEmail(extractedEmail) : '';
            const emailCertainty = correctedEmail ? checkEmailCertainty(correctedEmail) : 'uncertain';
            const emailWasCorrected = extractedEmail !== correctedEmail;
            const phoneIsComplete = extractedPhone ? /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(extractedPhone) : false;
            const isPerfect = correctedEmail && extractedPhone && emailCertainty === 'certain' && !emailWasCorrected && phoneIsComplete;
            return isPerfect ? 'Submit' : 'Next';
        }
        return modalState.section === 'contact' ? 'Submit' : 'Next';
    }

    function renderNavigation() {
        const nav = document.getElementById('aiSignupNav');
        if (modalState.section === 'parsing' || modalState.section === 'loading' || modalState.section === 'final') {
            nav.innerHTML = '';
            return;
        }
        const buttonText = getButtonText();
        const showBack = modalState.section === 'contact';
        nav.innerHTML = (showBack ? '<button class="ai-signup-btn-secondary" onclick="handleAiSignupBack()">← Back</button>' : '') +
            '<button class="ai-signup-btn-primary" onclick="handleAiSignupNext()">' + buttonText + '</button>';
    }

    function renderFreeform() {
        const content = document.getElementById('aiSignupContent');
        content.innerHTML = '<div class="ai-signup-freeform"><p class="ai-signup-instruction">Describe your unique logistics needs in your own words</p><textarea id="aiSignupText" class="ai-signup-textarea" rows="8" placeholder="ex.\nI need a quiet space near downtown, weekly from Monday to Friday.\n\nSend to john@gmail.com or call (415) 555-5555"></textarea><div class="ai-signup-helper">💡 Include your email and phone number for faster processing</div></div>';
        const textarea = document.getElementById('aiSignupText');
        textarea.value = modalState.formData.marketResearchText || '';
        textarea.addEventListener('input', (e) => {
            modalState.formData.marketResearchText = e.target.value;
            renderNavigation();
        });
        renderNavigation();
    }

    function renderParsing() {
        const content = document.getElementById('aiSignupContent');
        content.innerHTML = '<div class="ai-signup-parsing"><div id="parsingLottie" class="ai-signup-lottie"></div><h3 class="ai-signup-message">Analyzing your request...</h3><p class="ai-signup-submessage">Please wait while we extract the information</p></div>';
        renderNavigation();
        if (window.lottie) {
            // Ensure any previous instances are destroyed
            if (modalState.lottieInstances.parsing) {
                modalState.lottieInstances.parsing.destroy();
            }
            modalState.lottieInstances.parsing = window.lottie.loadAnimation({
                container: document.getElementById('parsingLottie'),
                renderer: 'svg', loop: true, autoplay: true, path: PARSING_LOTTIE_URL, speed: 0.25
            });
        }
    }

    function renderContact() {
        const content = document.getElementById('aiSignupContent');
        content.innerHTML = '<div class="ai-signup-contact"><h3 class="ai-signup-heading">Where do we send the report?</h3><div class="ai-signup-form-group"><label class="ai-signup-label">Your email <span class="ai-signup-required">*</span></label><input type="email" id="aiSignupEmail" class="ai-signup-input" placeholder="your.email@example.com" required></div><div class="ai-signup-form-group"><label class="ai-signup-label">Phone number (optional)</label><input type="tel" id="aiSignupPhone" class="ai-signup-input" placeholder="(415) 555-5555"></div><p class="ai-signup-disclaimer">We\'ll send your personalized market research report to this email address.</p></div>';
        document.getElementById('aiSignupEmail').value = modalState.formData.email || '';
        document.getElementById('aiSignupPhone').value = modalState.formData.phone || '';
        document.getElementById('aiSignupEmail').addEventListener('input', (e) => { modalState.formData.email = e.target.value; });
        document.getElementById('aiSignupPhone').addEventListener('input', (e) => { modalState.formData.phone = e.target.value; });
        renderNavigation();
    }

    function renderLoading() {
        const content = document.getElementById('aiSignupContent');
        content.innerHTML = '<div class="ai-signup-loading"><div id="loadingLottie" class="ai-signup-lottie"></div><h3 class="ai-signup-message">We are processing your request</h3><p class="ai-signup-submessage">This will only take a moment...</p></div>';
        renderNavigation();
        if (window.lottie) {
            // Ensure any previous instances are destroyed
            if (modalState.lottieInstances.loading) {
                modalState.lottieInstances.loading.destroy();
            }
            modalState.lottieInstances.loading = window.lottie.loadAnimation({
                container: document.getElementById('loadingLottie'),
                renderer: 'svg', loop: true, autoplay: true, path: LOADING_LOTTIE_URL, speed: 0.25
            });
        }
    }

    function renderFinal() {
        const content = document.getElementById('aiSignupContent');
        content.innerHTML = '<div class="ai-signup-final"><div id="successLottie" class="ai-signup-lottie-success"></div><h3 class="ai-signup-message">Success!</h3><p class="ai-signup-final-message">Tomorrow morning, you\'ll receive a full report.</p><p class="ai-signup-submessage">Check your inbox for the comprehensive market research report.</p></div>';
        if (window.lottie) {
            // Ensure any previous instances are destroyed
            if (modalState.lottieInstances.success) {
                modalState.lottieInstances.success.destroy();
            }
            modalState.lottieInstances.success = window.lottie.loadAnimation({
                container: document.getElementById('successLottie'),
                renderer: 'svg', loop: true, autoplay: true, path: SUCCESS_LOTTIE_URL, speed: 0.25
            });
        }
        const nav = document.getElementById('aiSignupNav');
        nav.innerHTML = '<button class="ai-signup-btn-primary" onclick="closeAiSignupModal()">Close</button>';
    }

    function showError(message) {
        const errorDiv = document.getElementById('aiSignupError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    async function submitToBubble() {
        if (!modalState.formData.email) {
            showError('Email is required');
            return;
        }
        modalState.section = 'loading';
        renderLoading();
        try {
            const response = await fetch(BUBBLE_WORKFLOW_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
                body: JSON.stringify({
                    email: modalState.formData.email,
                    phone: modalState.formData.phone || '',
                    'text inputted': modalState.formData.marketResearchText
                })
            });
            if (!response.ok) throw new Error(`Signup failed: ${response.status}`);
            console.log('✅ Form submitted successfully to Bubble');
            setTimeout(() => { modalState.section = 'final'; renderFinal(); }, 1500);
        } catch (error) {
            console.error('❌ Submission error:', error);
            showError(error.message || 'Signup failed. Please try again.');
            modalState.section = 'contact';
            renderContact();
        }
    }

    window.openAiSignupModal = function() {
        modalState.isOpen = true;
        modalState.section = 'freeform';
        modalState.formData = {};
        document.getElementById('ai-signup-modal').style.display = 'flex';
        renderFreeform();
    };

    window.closeAiSignupModal = function() {
        Object.values(modalState.lottieInstances).forEach(instance => { if (instance) instance.destroy(); });
        modalState.lottieInstances = {};
        modalState.isOpen = false;
        document.getElementById('ai-signup-modal').style.display = 'none';
    };

    window.handleAiSignupBack = function() {
        modalState.section = 'freeform';
        renderFreeform();
    };

    window.handleAiSignupNext = async function() {
        if (modalState.section === 'freeform') {
            modalState.section = 'parsing';
            renderParsing();
            await new Promise(resolve => setTimeout(resolve, 1500));
            const extractedEmail = extractEmail(modalState.formData.marketResearchText || '');
            const extractedPhone = extractPhone(modalState.formData.marketResearchText || '');
            const correctedEmail = extractedEmail ? autoCorrectEmail(extractedEmail) : '';
            const emailCertainty = correctedEmail ? checkEmailCertainty(correctedEmail) : 'uncertain';
            const emailWasCorrected = extractedEmail !== correctedEmail;
            const phoneIsComplete = extractedPhone ? /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(extractedPhone) : false;
            modalState.formData.email = correctedEmail || '';
            modalState.formData.phone = extractedPhone || '';
            const shouldAutoSubmit = correctedEmail && extractedPhone && emailCertainty === 'certain' && !emailWasCorrected && phoneIsComplete;
            if (shouldAutoSubmit) {
                console.log('✅ Perfect data - Auto-submitting');
                await submitToBubble();
            } else {
                console.log('⚠️ Showing contact form for verification');
                modalState.section = 'contact';
                renderContact();
            }
        } else if (modalState.section === 'contact') {
            await submitToBubble();
        }
    };

    function initModal() {
        const modalHTML = '<div id="ai-signup-modal" class="ai-signup-overlay" style="display: none;"><div class="ai-signup-modal"><div class="ai-signup-header"><div id="headerIconLottie" class="ai-signup-icon"></div><h2 class="ai-signup-title">Market Research for Lodging, Storage, Transport, Restaurants and more</h2><button class="ai-signup-close" onclick="closeAiSignupModal()">&times;</button></div><div class="ai-signup-content" id="aiSignupContent"></div><div class="ai-signup-error" id="aiSignupError" style="display: none;"></div><div class="ai-signup-nav" id="aiSignupNav"></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Initialize header icon Lottie animation
        if (window.lottie) {
            const headerIconContainer = document.getElementById('headerIconLottie');
            if (headerIconContainer) {
                modalState.lottieInstances.headerIcon = window.lottie.loadAnimation({
                    container: headerIconContainer,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: HEADER_ICON_LOTTIE_URL,
                    speed: 0.25
                });
                console.log('✅ Header icon Lottie loaded');
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModal);
    } else {
        initModal();
    }
})();
