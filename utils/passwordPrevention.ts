/**
 * Aggressive password manager prevention utilities
 */
export class PasswordPrevention {
    private static instance: PasswordPrevention;
    private intervalId: NodeJS.Timeout | null = null;

    constructor() {
        if (PasswordPrevention.instance) {
            return PasswordPrevention.instance;
        }
        PasswordPrevention.instance = this;
        this.init();
    }

    private init() {
        // Immediate prevention
        this.preventPasswords();
        
        // Continuous prevention every 100ms
        this.intervalId = setInterval(() => {
            this.preventPasswords();
        }, 100);

        // Monitor focus events specifically
        document.addEventListener('focusin', this.handleFocusIn);
        document.addEventListener('focus', this.handleFocusIn);
        
        // Monitor input events
        document.addEventListener('input', this.handleInput);
        
        // Prevent context menu on password-like fields
        document.addEventListener('contextmenu', this.handleContextMenu);
        
        console.log('Aggressive password prevention activated');
    }

    private handleFocusIn = (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            this.applyAggressivePrevention(target as HTMLInputElement);
        }
    };

    private handleInput = (event: Event) => {
        const target = event.target as HTMLInputElement;
        if (target.maxLength === 4 || target.id?.includes('pin') || target.placeholder?.toLowerCase().includes('pin')) {
            this.applyAggressivePrevention(target);
        }
    };

    private handleContextMenu = (event: Event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).maxLength === 4) {
            event.preventDefault();
        }
    };

    private preventPasswords() {
        // Target all potential PIN/password fields
        const selectors = [
            'input[maxlength="4"]',
            'input[type="password"]',
            'input[type="text"][maxlength*="4"]',
            'input[id*="pin"]',
            'input[name*="pin"]',
            'input[placeholder*="pin" i]',
            'input[aria-label*="pin" i]',
            'input[autocomplete*="password"]'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                this.applyAggressivePrevention(element as HTMLInputElement);
            });
        });

        // Also prevent on all forms
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.setAttribute('autocomplete', 'off');
            form.setAttribute('data-form-autocomplete-off', 'true');
        });
    }

    private applyAggressivePrevention(input: HTMLInputElement) {
        // Remove any autocomplete attributes that might trigger password managers
        input.removeAttribute('autocomplete');
        input.setAttribute('autocomplete', 'new-password-off');
        
        // Set all prevention attributes
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('data-form-autocomplete-off', 'true');
        input.setAttribute('data-lpignore', 'true');
        input.setAttribute('data-bwignore', 'true');
        input.setAttribute('data-1p-ignore', 'true');
        input.setAttribute('data-kwimpalastpass', 'true');
        input.setAttribute('role', 'textbox');
        
        // Force the browser to not treat it as a password field
        if (input.type === 'password') {
            input.type = 'text';
        }
        
        // Add style to prevent password manager UI
        input.style.setProperty('-webkit-text-security', 'disc', 'important');
        input.style.setProperty('font-family', 'monospace', 'important');
        
        // Override any browser-injected styles
        const style = input.getAttribute('style');
        if (style && !style.includes('-webkit-text-security')) {
            input.setAttribute('style', style + '; -webkit-text-security: disc !important;');
        }
    }

    public destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        document.removeEventListener('focusin', this.handleFocusIn);
        document.removeEventListener('focus', this.handleFocusIn);
        document.removeEventListener('input', this.handleInput);
        document.removeEventListener('contextmenu', this.handleContextMenu);
    }
}

// Export singleton instance
export const passwordPrevention = new PasswordPrevention();