import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'DFP-NEO | Daily Flying Program',
  description: 'Advanced flight scheduling and management system',
  icons: {
    icon: '/images/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            /* IMMEDIATE Purple Button Destruction - Maximum Specificity */
            button[style*="rgb(118, 75, 162)"],
            button[style*="118, 75, 162"],
            button[style*="#764ba2"],
            *[style*="background: rgb(118, 75, 162)"],
            *[style*="background-color: rgb(118, 75, 162)"],
            *[style*="rgb(118, 75, 162)"] {
              background-color: #374151 !important;
              background: #374151 !important;
              color: #ffffff !important;
              border-color: #4b5563 !important;
            }
          `
        }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{
          __html: `
            // DFP-NEO AGGRESSIVE Purple Button Elimination Script
            function eliminatePurpleButtons() {
              // Target specific purple RGB values
              const purpleRGB = 'rgb(118, 75, 162)';
              const purpleRGBValues = ['118, 75, 162', '118,75,162'];
              
              // Find ALL buttons with any purple styling
              const buttons = document.querySelectorAll('button');
              buttons.forEach(button => {
                const computedStyle = window.getComputedStyle(button);
                const backgroundColor = computedStyle.backgroundColor;
                
                // Check for purple background in computed style
                const isPurpleComputed = backgroundColor === purpleRGB || 
                                       purpleRGBValues.some(rgb => backgroundColor.includes(rgb));
                
                // Check for purple inline styles
                const inlineBackground = button.style.backgroundColor;
                const isPurpleInline = inlineBackground === purpleRGB || 
                                    inlineBackground === '#764ba2' ||
                                    purpleRGBValues.some(rgb => inlineBackground.includes(rgb));
                
                // Check for purple in element.style from HTML inspection
                const elementStyle = button.getAttribute('style');
                const isPurpleElementStyle = elementStyle && 
                                          (elementStyle.includes('rgb(118, 75, 162)') ||
                                           elementStyle.includes('118, 75, 162') ||
                                           elementStyle.includes('#764ba2'));
                
                if (isPurpleComputed || isPurpleInline || isPurpleElementStyle) {
                  // FORCE override with MAXIMUM priority !important styles
                  button.style.setProperty('background-color', '#374151', 'important');
                  button.style.setProperty('color', '#ffffff', 'important');
                  button.style.setProperty('border-color', '#4b5563', 'important');
                  
                  // Also override any CSS custom properties
                  button.style.setProperty('background', '#374151', 'important');
                  
                  console.log('DFP-NEO: AGGRESSIVELY eliminated purple button:', button.textContent, 'Reason:', {
                    computed: isPurpleComputed,
                    inline: isPurpleInline,
                    elementStyle: isPurpleElementStyle
                  });
                }
              });
              
              // Also check for any elements with purple styling (not just buttons)
              const allElements = document.querySelectorAll('*');
              allElements.forEach(element => {
                const style = element.getAttribute('style');
                if (style && (style.includes('rgb(118, 75, 162)') || 
                            style.includes('118, 75, 162') ||
                            style.includes('#764ba2'))) {
                  element.style.setProperty('background-color', '#374151', 'important');
                  element.style.setProperty('color', '#ffffff', 'important');
                  element.style.setProperty('background', '#374151', 'important');
                  console.log('DFP-NEO: Fixed purple element:', element.tagName, element.className);
                }
              });
            }
            
            // Run immediately and frequently
            eliminatePurpleButtons();
            
            // Run every 500ms for more aggressive catching
            setInterval(eliminatePurpleButtons, 500);
            
            // Also run when DOM changes with faster response
            const observer = new MutationObserver(() => {
              setTimeout(eliminatePurpleButtons, 50);
            });
            
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style']
            });
            
            // Also run on window focus and mouse movement (user interaction)
            ['focus', 'mousemove', 'click'].forEach(event => {
              document.addEventListener(event, () => {
                setTimeout(eliminatePurpleButtons, 100);
              });
            });
            
            // Global function for manual trigger
            window.eliminatePurpleButtons = eliminatePurpleButtons;
            
            console.log('DFP-NEO: Purple button elimination system activated');
          `
        }} />
      </body>
    </html>
  );
}