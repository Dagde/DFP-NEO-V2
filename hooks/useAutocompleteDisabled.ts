import { useEffect } from 'react';
import { passwordPrevention } from '../utils/passwordPrevention';

/**
 * Hook to disable autocomplete, autocorrect, autocapitalize, and spellcheck
 * on all form elements throughout the application
 */
export const useAutocompleteDisabled = () => {
    useEffect(() => {
        const disableAutocomplete = () => {
            // Disable autocomplete on all inputs, textareas, and selects
            const elements = document.querySelectorAll('input, textarea, select');
            elements.forEach(element => {
                element.setAttribute('autocomplete', 'off');
                element.setAttribute('autocorrect', 'off');
                element.setAttribute('autocapitalize', 'off');
                element.setAttribute('spellcheck', 'false');
                
                // Additional attributes for password prevention
                element.setAttribute('data-form-autocomplete-off', 'true');
                element.setAttribute('data-lpignore', 'true'); // LastPass
                element.setAttribute('data-bwignore', 'true'); // Bitwarden
            });

            // Disable autocomplete on all forms
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                form.setAttribute('autocomplete', 'off');
                form.setAttribute('data-form-autocomplete-off', 'true');
            });
        };

        // Run immediately
        disableAutocomplete();

        // Monitor for dynamically added elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the node itself is a form element
                        if (node.tagName === 'FORM') {
                            node.setAttribute('autocomplete', 'off');
                            node.setAttribute('data-form-autocomplete-off', 'true');
                        }
                        
                        // Check if the node itself is an input element
                        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
                            node.setAttribute('autocomplete', 'off');
                            node.setAttribute('autocorrect', 'off');
                            node.setAttribute('autocapitalize', 'off');
                            node.setAttribute('spellcheck', 'false');
                            node.setAttribute('data-form-autocomplete-off', 'true');
                            node.setAttribute('data-lpignore', 'true');
                            node.setAttribute('data-bwignore', 'true');
                        }
                        
                        // Check children of the added node
                        const inputs = node.querySelectorAll ? node.querySelectorAll('input, textarea, select, form') : [];
                        inputs.forEach(input => {
                            if (input.tagName === 'FORM') {
                                input.setAttribute('autocomplete', 'off');
                                input.setAttribute('data-form-autocomplete-off', 'true');
                            } else {
                                input.setAttribute('autocomplete', 'off');
                                input.setAttribute('autocorrect', 'off');
                                input.setAttribute('autocapitalize', 'off');
                                input.setAttribute('spellcheck', 'false');
                                input.setAttribute('data-form-autocomplete-off', 'true');
                                input.setAttribute('data-lpignore', 'true');
                                input.setAttribute('data-bwignore', 'true');
                            }
                        });
                    }
                });
            });
        });

        // Start observing the entire document
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['type']
        });

        // Also run periodically to catch any missed elements
        const interval = setInterval(disableAutocomplete, 500);

        console.log('Enhanced password/autocomplete protection enabled');

        return () => {
            observer.disconnect();
            clearInterval(interval);
        };
    }, []);
};

export default useAutocompleteDisabled;