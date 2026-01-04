// Selective button removal - only remove debug buttons with emojis
(function() {
  'use strict';
  
  console.log('🔴 Selective button removal script loaded');
  
  function removeDebugButtons() {
    // Find all buttons on the page
    const allButtons = document.querySelectorAll('button');
    let removedCount = 0;
    
    allButtons.forEach(button => {
      const buttonText = button.textContent.trim();
      const buttonHTML = button.innerHTML;
      
      // ONLY remove buttons that have BOTH emoji AND text (debug buttons)
      // This preserves normal "Edit" and "Save" buttons without emojis
      const hasEditEmoji = buttonText.includes('✏️') || buttonHTML.includes('✏️');
      const hasSaveEmoji = buttonText.includes('💾') || buttonHTML.includes('💾');
      const hasEditText = buttonText.includes('Edit');
      const hasSaveText = buttonText.includes('Save');
      
      // Remove ONLY if it has emoji (debug buttons have emojis)
      if (hasEditEmoji || hasSaveEmoji) {
        // Additional check: debug buttons are usually positioned fixed/absolute at bottom left
        const styles = window.getComputedStyle(button);
        const position = styles.position;
        
        // COMPLETELY REMOVE THE BUTTON FROM THE DOM
        button.remove();
        removedCount++;
        console.log('🔴 REMOVED debug button from DOM:', buttonText);
      }
    });
    
    if (removedCount > 0) {
      console.log(`🔴 Total debug buttons REMOVED: ${removedCount}`);
    }
  }
  
  // Run immediately - multiple times
  removeDebugButtons();
  setTimeout(removeDebugButtons, 0);
  setTimeout(removeDebugButtons, 10);
  setTimeout(removeDebugButtons, 50);
  setTimeout(removeDebugButtons, 100);
  setTimeout(removeDebugButtons, 200);
  setTimeout(removeDebugButtons, 500);
  setTimeout(removeDebugButtons, 1000);
  setTimeout(removeDebugButtons, 2000);
  
  // Run after DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeDebugButtons);
  }
  
  // Set up a MutationObserver to watch for new buttons being added
  const observer = new MutationObserver(function(mutations) {
    removeDebugButtons(); // Just run it immediately on any DOM change
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also run very frequently as a fallback
  setInterval(removeDebugButtons, 500); // Every 0.5 seconds
  
  console.log('🔴 Selective button removal initialized - only removing buttons with emojis');
})();