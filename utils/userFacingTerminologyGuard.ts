import { sanitizeUserFacingTerminology } from './userFacingTerminology';

const IGNORED_PARENT_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);

const sanitizeTextNode = (node: Text) => {
  const parentTag = node.parentElement?.tagName;
  if (parentTag && IGNORED_PARENT_TAGS.has(parentTag)) return;

  const original = node.nodeValue || '';
  const sanitized = sanitizeUserFacingTerminology(original);
  if (sanitized !== original) {
    node.nodeValue = sanitized;
  }
};

const sanitizeElementText = (root: ParentNode) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    sanitizeTextNode(current as Text);
    current = walker.nextNode();
  }
};

export const installUserFacingTerminologyGuard = (root: HTMLElement): (() => void) => {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => undefined;
  }

  let frameId = 0;
  const scheduleSanitize = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      sanitizeElementText(root);
    });
  };

  sanitizeElementText(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
        sanitizeTextNode(mutation.target as Text);
        continue;
      }

      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        scheduleSanitize();
        break;
      }
    }
  });

  observer.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  return () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    observer.disconnect();
  };
};
