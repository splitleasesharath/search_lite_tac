import React, { useState, useEffect } from 'react';
import './ContactHostMessaging.css';

/**
 * ContactHostMessaging - Modal component for non-logged-in users to contact property hosts
 * @param {Object} listing - Listing object with id, title, hostId, hostName
 * @param {Object} currentUser - Current user object (null if not logged in)
 * @param {boolean} isOpen - Controls modal visibility
 * @param {Function} onClose - Callback when modal closes
 */
const ContactHostMessaging = ({
  listing,
  currentUser,
  isOpen,
  onClose
}) => {
  // State management
  const [currentView, setCurrentView] = useState('contactForm');
  const [messageSent, setMessageSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    userName: currentUser?.firstName || '',
    subject: listing?.title || '',
    messageBody: '',
    email: currentUser?.email || ''
  });
  const [errors, setErrors] = useState({});
  const isLoggedIn = !!currentUser;

  // Update form data when currentUser or listing changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      userName: currentUser?.firstName || prev.userName,
      subject: listing?.title || prev.subject,
      email: currentUser?.email || prev.email
    }));
  }, [currentUser, listing]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.userName.trim()) {
      newErrors.userName = 'Name is required';
    }

    if (!formData.messageBody.trim()) {
      newErrors.messageBody = 'Message is required';
    } else if (formData.messageBody.trim().length < 10) {
      newErrors.messageBody = 'Message must be at least 10 characters';
    }

    if (!isLoggedIn && !formData.email.trim()) {
      newErrors.email = 'Email is required for guest users';
    } else if (!isLoggedIn && formData.email.trim() && !isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Email validation helper
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle form submission
  const handleSendMessage = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // API call to send message
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listingId: listing.id,
          hostId: listing.hostId,
          senderName: formData.userName,
          senderEmail: formData.email,
          subject: formData.subject,
          message: formData.messageBody,
          userId: currentUser?.id || null,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessageSent(true);
        setCurrentView('success');
      } else {
        setErrors({
          submit: data.message || 'Failed to send message. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setErrors({
        submit: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle email button click
  const handleEmailClick = () => {
    setCurrentView('contactForm');
    // Focus on email field after view changes
    setTimeout(() => {
      const emailInput = document.querySelector('input[type="email"]');
      if (emailInput) emailInput.focus();
    }, 100);
  };

  // Handle private message button click
  const handlePrivateMessageClick = () => {
    if (!isLoggedIn) {
      setCurrentView('requireSignup');
    } else {
      // If logged in, proceed to send message
      setCurrentView('contactForm');
    }
  };

  // Reset and close
  const handleClose = () => {
    setCurrentView('contactForm');
    setMessageSent(false);
    setIsSubmitting(false);
    setFormData({
      userName: currentUser?.firstName || '',
      subject: listing?.title || '',
      messageBody: '',
      email: currentUser?.email || ''
    });
    setErrors({});
    onClose();
  };

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Render contact form view
  const renderContactForm = () => (
    <div className="contact-form-view">
      <div className="form-header">
        <span className="icon" role="img" aria-label="messaging">
          💬
        </span>
        <h2>Message {listing?.hostName || 'Host'}</h2>
        {formData.subject && (
          <p className="subject">{formData.subject}</p>
        )}
      </div>

      {isLoggedIn && (
        <p className="logged-in-status">
          Logged in as {currentUser?.firstName} {currentUser?.lastName}
        </p>
      )}

      <div className="form-group">
        <label htmlFor="userName" className="sr-only">Your Name</label>
        <input
          id="userName"
          type="text"
          placeholder="Your name"
          value={formData.userName}
          onChange={(e) => handleInputChange('userName', e.target.value)}
          className={errors.userName ? 'error' : ''}
          disabled={isLoggedIn}
          aria-invalid={!!errors.userName}
          aria-describedby={errors.userName ? 'userName-error' : undefined}
        />
        {errors.userName && (
          <span id="userName-error" className="error-text" role="alert">
            {errors.userName}
          </span>
        )}
      </div>

      {!isLoggedIn && (
        <div className="form-group">
          <label htmlFor="email" className="sr-only">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={errors.email ? 'error' : ''}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <span id="email-error" className="error-text" role="alert">
              {errors.email}
            </span>
          )}
          <a
            href="https://app.split.lease/signup-login"
            className="signup-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sign Up to increase your chance of a host replying and to track messages inside Split Lease
          </a>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="messageBody" className="sr-only">Your Message</label>
        <textarea
          id="messageBody"
          placeholder="Your message..."
          rows="5"
          value={formData.messageBody}
          onChange={(e) => handleInputChange('messageBody', e.target.value)}
          className={errors.messageBody ? 'error' : ''}
          aria-invalid={!!errors.messageBody}
          aria-describedby={errors.messageBody ? 'messageBody-error' : undefined}
        />
        {errors.messageBody && (
          <span id="messageBody-error" className="error-text" role="alert">
            {errors.messageBody}
          </span>
        )}
      </div>

      <button
        className="btn-primary btn-send"
        onClick={handleSendMessage}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Sending...' : 'Send message'}
      </button>

      {errors.submit && (
        <div className="error-banner" role="alert">
          {errors.submit}
        </div>
      )}
    </div>
  );

  // Render success view
  const renderSuccessView = () => (
    <div className="success-view">
      <div className="success-icon" role="img" aria-label="success">
        ✓
      </div>
      <h3>It's on its way!!</h3>
      <p>Your message has been sent.</p>
      <button
        className="btn-primary"
        onClick={handleClose}
        autoFocus
      >
        Done
      </button>
    </div>
  );

  // Render provide email view
  const renderProvideEmailView = () => (
    <div className="provide-email-view">
      <h3>Provide Email or Sign Up</h3>
      <p>No Email Provided. How would you like the host to contact you?</p>

      <button
        className="btn-secondary"
        onClick={handleEmailClick}
      >
        Email
      </button>

      <button
        className="btn-primary"
        onClick={handlePrivateMessageClick}
      >
        Private Message
      </button>

      {!isLoggedIn && (
        <p className="info-text">
          You must create an account and be logged in to send private messages
        </p>
      )}
    </div>
  );

  // Render require signup view
  const renderRequireSignupView = () => (
    <div className="require-signup-view">
      <p>You must create an account and be logged in to send private messages</p>

      <button
        className="btn-primary"
        onClick={() => window.location.href = 'https://app.split.lease/signup-login'}
      >
        Sign Up
      </button>

      <button
        className="btn-secondary"
        onClick={() => setCurrentView('contactForm')}
      >
        Go Back
      </button>
    </div>
  );

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="contact-host-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="btn-close"
          onClick={handleClose}
          aria-label="Close dialog"
        >
          ×
        </button>

        {currentView === 'contactForm' && renderContactForm()}
        {currentView === 'success' && renderSuccessView()}
        {currentView === 'provideEmail' && renderProvideEmailView()}
        {currentView === 'requireSignup' && renderRequireSignupView()}
      </div>
    </div>
  );
};

export default ContactHostMessaging;
