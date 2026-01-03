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
      <body>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{
          __html: `
            // DFP-NEO Purple Button Elimination Script
            function eliminatePurpleButtons() {
              // Target specific purple RGB values
              const purpleRGB = 'rgb(118, 75, 162)';
              const purpleHex = '#764ba2';
              
              // Find all buttons with purple styling
              const buttons = document.querySelectorAll('button');
              buttons.forEach(button => {
                const style = window.getComputedStyle(button);
                const backgroundColor = style.backgroundColor;
                
                // Check for purple background
                if (backgroundColor === purpleRGB || 
                    backgroundColor.includes('118, 75, 162') ||
                    button.style.backgroundColor === purpleRGB ||
                    button.style.backgroundColor === purpleHex) {
                  
                  // Override with gray styling
                  button.style.setProperty('background-color', '#374151', 'important');
                  button.style.setProperty('color', '#ffffff', 'important');
                  button.style.setProperty('border-color', '#4b5563', 'important');
                  
                  console.log('DFP-NEO: Eliminated purple button:', button.textContent);
                }
              });
              
              // Also check for elements with purple classes
              const purpleElements = document.querySelectorAll('[class*="purple"], .bg-purple, .text-purple, .border-purple');
              purpleElements.forEach(element => {
                element.style.setProperty('background-color', '#4b5563', 'important');
                element.style.setProperty('color', '#ffffff', 'important');
                element.style.setProperty('border-color', '#374151', 'important');
              });
            }
            
            // Run immediately and periodically
            eliminatePurpleButtons();
            setInterval(eliminatePurpleButtons, 1000);
            
            // Also run when DOM changes
            const observer = new MutationObserver(() => {
              setTimeout(eliminatePurpleButtons, 100);
            });
            
            observer.observe(document.body, {
              childList: true,
              subtree: true
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