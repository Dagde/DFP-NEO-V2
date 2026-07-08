import React from 'react';

export const isEditableElement = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable ||
    Boolean(element.closest('[contenteditable="true"]'))
  );
};

export const stopEditableKeyPropagation = (event: React.KeyboardEvent<HTMLElement>) => {
  if (isEditableElement(event.target)) {
    if (event.target instanceof HTMLTextAreaElement && event.key === 'Enter') {
      return;
    }
    event.stopPropagation();
  }
};
