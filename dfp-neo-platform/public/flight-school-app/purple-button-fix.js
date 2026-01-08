// DFP-NEO Purple Button Nuclear Fix
// This script directly overwrites inline styles on purple buttons every 100ms

(function() {
    'use strict';
    
    console.log('DFP-NEO: Purple button fix script loaded');
    
    // Main function to nuke purple buttons
    function nukeInlineStyles() {
        const buttons = document.querySelectorAll('button');
        
        buttons.forEach(btn => {
            const text = btn.textContent || '';
            const hasEditEmoji = text.includes('✏️');
            const hasSaveEmoji = text.includes('💾');
            
            // If it has Edit or Save emoji, force blue background
            if (hasEditEmoji || hasSaveEmoji) {
                btn.style.background = '#3b82f6';
                btn.style.backgroundColor = '#3b82f6';
                btn.style.setProperty('background', '#3b82f6', 'important');
                btn.style.setProperty('background-color', '#3b82f6', 'important');
                
                console.log('DFP-NEO: Nuked purple button:', text.trim());
            }
        });
    }
    
    // Solo flight fix
    function fixSoloFlights() {
        const soloButtons = document.querySelectorAll('button');
        soloButtons.forEach(btn => {
            const text = btn.textContent || '';
            // Check for duplicate pilot names (solo flights)
            const matches = text.match(/([A-Z][a-z]+, [A-Z][a-z]+(?: [A-Z]\.)?)/g);
            if (matches && matches.length > 1) {
                const first = matches[0];
                const rest = matches.slice(1);
                btn.textContent = first + ' ' + rest.map(() => '<span style="color: gold; font-weight: bold;">$SOLO</span>').join(' ');
                console.log('DFP-NEO: Fixed solo flight:', first);
            }
        });
    }
    
    // Grey course fix
    function fixGreyCourses() {
        const courseElements = document.querySelectorAll('.course-indicator, [class*="course"]');
        courseElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.backgroundColor === 'rgb(128, 128, 128)' && !el.textContent.includes('SCT')) {
                el.style.backgroundColor = '#3b82f6';
                el.style.setProperty('background-color', '#3b82f6', 'important');
                console.log('DFP-NEO: Fixed grey course to blue:', el.textContent.trim());
            }
        });
    }
    
    // Initial fixes
    console.log('DFP-NEO: Running initial fixes...');
    nukeInlineStyles();
    
    // Run solo flight fix multiple times in first 3 seconds
    let soloFixCount = 0;
    const soloFixInterval = setInterval(() => {
        fixSoloFlights();
        soloFixCount++;
        if (soloFixCount >= 10) {
            clearInterval(soloFixInterval);
            // Then run every 2 seconds
            setInterval(fixSoloFlights, 2000);
        }
    }, 300);
    
    // Run grey course fix every 2 seconds
    setInterval(fixGreyCourses, 2000);
    
    // Main nuclear fix - run every 100ms forever
    setInterval(nukeInlineStyles, 100);
    console.log('DFP-NEO: Nuclear style fix active - running every 100ms');
    
    // MutationObserver to catch dynamically added buttons
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const buttons = node.querySelectorAll ? node.querySelectorAll('button') : [];
                        buttons.forEach(btn => {
                            const text = btn.textContent || '';
                            const hasEditEmoji = text.includes('✏️');
                            const hasSaveEmoji = text.includes('💾');
                            
                            if (hasEditEmoji || hasSaveEmoji) {
                                btn.style.background = '#3b82f6';
                                btn.style.backgroundColor = '#3b82f6';
                                btn.style.setProperty('background', '#3b82f6', 'important');
                                btn.style.setProperty('background-color', '#3b82f6', 'important');
                                
                                console.log('DFP-NEO: Nuked purple button (via MutationObserver):', text.trim());
                            }
                        });
                    }
                });
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.tagName === 'BUTTON') {
                    const text = target.textContent || '';
                    const hasEditEmoji = text.includes('✏️');
                    const hasSaveEmoji = text.includes('💾');
                    
                    if (hasEditEmoji || hasSaveEmoji) {
                        target.style.background = '#3b82f6';
                        target.style.backgroundColor = '#3b82f6';
                        target.style.setProperty('background', '#3b82f6', 'important');
                        target.style.setProperty('background-color', '#3b82f6', 'important');
                        
                        console.log('DFP-NEO: Nuked purple button (style change):', text.trim());
                    }
                }
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
    });
    
    console.log('DFP-NEO: MutationObserver watching for new buttons');
    
})();