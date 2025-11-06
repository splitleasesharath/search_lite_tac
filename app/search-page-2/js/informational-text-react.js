/**
 * React Component for Informational Text
 * This file contains the React component that renders the informational text popover
 *
 * Dependencies:
 * - React 18
 * - ReactDOM 18
 * - Babel Standalone
 * - Tailwind CSS
 *
 * Usage: This file should be loaded with type="text/babel" so Babel can transpile the JSX
 */

(function() {
    'use strict';

    const { useState, useRef, useEffect, forwardRef, useImperativeHandle } = React;

    // Icon Components
    const X = ({ className = "w-5 h-5" }) => (
        React.createElement('svg', { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
            React.createElement('line', { x1: "18", y1: "6", x2: "6", y2: "18" }),
            React.createElement('line', { x1: "6", y1: "6", x2: "18", y2: "18" })
        )
    );

    const ChevronDown = ({ className = "w-4 h-4" }) => (
        React.createElement('svg', { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
            React.createElement('polyline', { points: "6 9 12 15 18 9" })
        )
    );

    const ChevronUp = ({ className = "w-4 h-4" }) => (
        React.createElement('svg', { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
            React.createElement('polyline', { points: "18 15 12 9 6 15" })
        )
    );

    const InfoIcon = ({ className = "w-5 h-5" }) => (
        React.createElement('svg', { className, viewBox: "0 0 24 24", fill: "currentColor" },
            React.createElement('path', { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" })
        )
    );

    // Helper function to capitalize first letter of each word
    const capitalizeTitle = (str) => {
        if (!str) return str;
        return str.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    // InformationalText Component
    const InformationalText = forwardRef((props, ref) => {
        const {
            elementId,
            title,
            content,
            expandedContent,
            initialVisible = false,
            triggerElementId,
            positionOffset = 10,
            onClose,
            className = '',
        } = props;

        const [isExpanded, setIsExpanded] = useState(false);
        const [isVisible, setIsVisible] = useState(initialVisible);
        const [dynamicTitle, setDynamicTitle] = useState(title);
        const [dynamicContent, setDynamicContent] = useState(content);
        const [dynamicExpandedContent, setDynamicExpandedContent] = useState(expandedContent);
        const [currentTriggerId, setCurrentTriggerId] = useState(triggerElementId);

        const containerRef = useRef(null);

        // Bubble's positioning logic
        const handlePositioning = () => {
            if (!containerRef.current) return;
            const panel = containerRef.current;
            if (!currentTriggerId) return;

            const trigger = document.getElementById(currentTriggerId);
            if (!trigger) return;

            const rect = trigger.getBoundingClientRect();
            panel.style.display = 'block';
            const panelWidth = panel.offsetWidth;

            // Center the panel relative to the trigger
            const left = rect.left + (rect.width / 2) - (panelWidth / 2);

            // Place panel below the trigger
            const top = rect.bottom + window.scrollY + positionOffset;

            panel.style.position = 'absolute';
            panel.style.left = (left + window.scrollX) + 'px';
            panel.style.top = top + 'px';
            panel.style.zIndex = '10000';
        };

        // Run positioning when visible or trigger changes
        useEffect(() => {
            if (isVisible && currentTriggerId) {
                handlePositioning();
            }
        }, [isVisible, currentTriggerId]);

        // Click outside to close
        useEffect(() => {
            if (!isVisible || !currentTriggerId) return;

            const handleClickOutside = (event) => {
                const trigger = document.getElementById(currentTriggerId);
                const panel = containerRef.current;
                if (!trigger || !panel) return;

                const isClickInsideTrigger = trigger.contains(event.target);
                const isClickInsidePanel = panel.contains(event.target);

                if (!isClickInsideTrigger && !isClickInsidePanel) {
                    setIsVisible(false);
                    setIsExpanded(false);
                }
            };

            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }, [isVisible, currentTriggerId]);

        // Close on scroll
        useEffect(() => {
            if (!isVisible) return;

            const handleScroll = () => {
                setIsVisible(false);
                setIsExpanded(false);
            };

            // Listen to scroll on window and all scrollable containers
            window.addEventListener('scroll', handleScroll, true);

            return () => {
                window.removeEventListener('scroll', handleScroll, true);
            };
        }, [isVisible]);

        const handleClose = () => {
            setIsVisible(false);
            setIsExpanded(false);
            onClose?.(elementId);
        };

        const handleToggleExpanded = () => {
            setIsExpanded(prev => !prev);
        };

        useImperativeHandle(ref, () => ({
            show: (triggerId, data) => {
                if (triggerId) setCurrentTriggerId(triggerId);
                if (data) {
                    if (data.title !== undefined) setDynamicTitle(data.title);
                    if (data.content !== undefined) setDynamicContent(data.content);
                    if (data.expandedContent !== undefined) setDynamicExpandedContent(data.expandedContent);
                }
                setIsVisible(true);
            },
            hide: () => {
                setIsVisible(false);
                setIsExpanded(false);
            },
            toggleExpanded: handleToggleExpanded,
        }));

        if (!isVisible) return null;

        const hasExpandedContent = dynamicExpandedContent && dynamicExpandedContent.trim().length > 0;
        const displayTitle = capitalizeTitle(dynamicTitle);
        const displayContent = isExpanded && hasExpandedContent ? dynamicExpandedContent : dynamicContent;

        return React.createElement('div', {
            ref: containerRef,
            className: `bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-full max-w-md ${className}`,
            style: { position: 'absolute', zIndex: 10000 }
        },
            React.createElement('div', { className: "flex items-start justify-between gap-4 mb-3" },
                displayTitle && React.createElement('div', { className: "flex items-center gap-2 flex-1" },
                    React.createElement(InfoIcon, { className: "w-5 h-5 flex-shrink-0", style: { color: '#3b82f6' } }),
                    React.createElement('h3', { className: "text-lg font-semibold text-gray-900" }, displayTitle)
                ),
                React.createElement('button', {
                    onClick: handleClose,
                    className: "flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
                },
                    React.createElement(X, { className: "w-5 h-5" })
                )
            ),
            React.createElement('div', { className: "text-gray-700 text-sm leading-relaxed" },
                React.createElement('p', { className: "mb-2" }, displayContent)
            ),
            hasExpandedContent && React.createElement('button', {
                onClick: handleToggleExpanded,
                className: "mt-3 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150"
            },
                React.createElement('span', null, isExpanded ? 'Show less' : 'Show more'),
                isExpanded ? React.createElement(ChevronUp) : React.createElement(ChevronDown)
            )
        );
    });

    // Main App Component
    function InfoApp() {
        const infoRef = useRef(null);

        // Make the ref accessible globally
        window.showInfoText = (triggerId, title, content, expandedContent) => {
            infoRef.current?.show(triggerId, {
                title: title || "Information",
                content: content || "Content not available",
                expandedContent: expandedContent || ""
            });
        };

        return React.createElement(InformationalText, {
            ref: infoRef,
            elementId: "activity-info",
            title: "Information",
            content: "Loading...",
            expandedContent: "",
            initialVisible: false,
            positionOffset: 10,
            onClose: () => console.log('Info closed')
        });
    }

    // Initialize React component when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReactComponent);
    } else {
        initReactComponent();
    }

    function initReactComponent() {
        const rootElement = document.getElementById('info-text-root');
        if (rootElement && typeof ReactDOM !== 'undefined') {
            ReactDOM.render(React.createElement(InfoApp), rootElement);
            console.log('✅ Informational Text React component initialized');
        } else {
            console.error('❌ Failed to initialize React component. Make sure #info-text-root exists and React is loaded.');
        }
    }

})();
