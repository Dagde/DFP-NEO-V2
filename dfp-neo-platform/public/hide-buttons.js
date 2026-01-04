// Ultra-aggressive button hiding script - removes buttons completely from DOM
(function() {
  'use strict';
  
  console.log('🔴 Button hiding script loaded');
  
  function hideButtons() {
    // Find all buttons on the page
    const allButtons = document.querySelectorAll('button');
    let hiddenCount = 0;
    
    allButtons.forEach(button => {
      const buttonText = button.textContent.trim();
      const buttonHTML = button.innerHTML;
      
      // Check if button contains Edit or Save text/emoji
      if (
        buttonText.includes('Edit') ||
        buttonText.includes('✏️') ||
        buttonText.includes('Save') ||
        buttonText.includes('💾') ||
        buttonHTML.includes('Edit') ||
        buttonHTML.includes('✏️') ||
        buttonHTML.includes('Save') ||
        buttonHTML.includes('💾')
      ) {
        // COMPLETELY REMOVE THE BUTTON FROM THE DOM
        button.remove();
        hiddenCount++;
        console.log('🔴 REMOVED button from DOM:', buttonText);
      }
    });
    
    if (hiddenCount > 0) {
      console.log(`🔴 Total buttons REMOVED: ${hiddenCount}`);
    }
  }
  
  // Run immediately - multiple times
  hideButtons();
  setTimeout(hideButtons, 0);
  setTimeout(hideButtons, 10);
  setTimeout(hideButtons, 50);
  setTimeout(hideButtons, 100);
  setTimeout(hideButtons, 200);
  setTimeout(hideButtons, 500);
  setTimeout(hideButtons, 1000);
  setTimeout(hideButtons, 2000);
  
  // Run after DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideButtons);
  }
  
  // Set up a MutationObserver to watch for new buttons being added
  const observer = new MutationObserver(function(mutations) {
    hideButtons(); // Just run it immediately on any DOM change
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also run very frequently as a fallback
  setInterval(hideButtons, 500); // Every 0.5 seconds instead of 3 seconds
  
  console.log('🔴 Button hiding script initialized - REMOVING buttons from DOM');
})();