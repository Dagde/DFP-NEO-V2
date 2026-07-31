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
    event.stopPropagation();
  }
};

export const insertEditableTextAtCursor = (
  field: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  onChange: (value: string) => void,
  maxLength?: number,
): boolean => {
  if (field.disabled || field.readOnly) return false;
  const currentValue = field.value || '';
  const selectionStart = field.selectionStart ?? currentValue.length;
  const selectionEnd = field.selectionEnd ?? selectionStart;
  const nextValue = `${currentValue.slice(0, selectionStart)}${text}${currentValue.slice(selectionEnd)}`;
  const limitedValue = typeof maxLength === 'number' ? nextValue.slice(0, maxLength) : nextValue;
  const nextCursor = Math.min(selectionStart + text.length, limitedValue.length);
  if (limitedValue === currentValue && selectionStart === selectionEnd) return false;
  onChange(limitedValue);
  window.requestAnimationFrame(() => {
    field.setSelectionRange(nextCursor, nextCursor);
  });
  return true;
};

export const handleEditableTextKeyDownCapture = (
  event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChange: (value: string) => void,
  maxLength?: number,
) => {
  if ((event.key === ' ' || event.code === 'Space' || event.key === 'Spacebar') && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    insertEditableTextAtCursor(event.currentTarget, ' ', onChange, maxLength);
    return;
  }
  stopEditableKeyPropagation(event);
};

export const handleEditableTextBeforeInput = (
  event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChange: (value: string) => void,
  maxLength?: number,
) => {
  const inputEvent = event.nativeEvent as InputEvent;
  if (inputEvent.inputType !== 'insertText' || inputEvent.data !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
  insertEditableTextAtCursor(event.currentTarget, ' ', onChange, maxLength);
};
