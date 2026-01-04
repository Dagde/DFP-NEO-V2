// Aggressive button hiding script
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
        // Hide the button completely
        button.style.display = 'none !important';
        button.style.visibility = 'hidden !important';
        button.style.opacity = '0 !important';
        button.style.pointerEvents = 'none !important';
        button.style.position = 'absolute !important';
        button.style.left = '-9999px !important';
        button.style.width = '0 !important';
        button.style.height = '0 !important';
        button.style.margin = '0 !important';
        button.style.padding = '0 !important';
        button.style.border = 'none !important';
        button.style.overflow = 'hidden !important';
        button.setAttribute('aria-hidden', 'true');
        button.setAttribute('disabled', 'true');
        hiddenCount++;
        console.log('🔴 Hidden button:', buttonText);
      }
    });
    
    if (hiddenCount > 0) {
      console.log(`🔴 Total buttons hidden: ${hiddenCount}`);
    }
  }
  
  // Run immediately
  hideButtons();
  
  // Run after DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideButtons);
  }
  
  // Run after a short delay to catch dynamically loaded buttons
  setTimeout(hideButtons, 100);
  setTimeout(hideButtons, 500);
  setTimeout(hideButtons, 1000);
  setTimeout(hideButtons, 2000);
  
  // Set up a MutationObserver to watch for new buttons being added
  const observer = new MutationObserver(function(mutations) {
    let shouldCheck = false;
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        shouldCheck = true;
      }
    });
    if (shouldCheck) {
      hideButtons();
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also run periodically as a fallback
  setInterval(hideButtons, 3000);
  
  console.log('🔴 Button hiding script initialized with MutationObserver');
})();