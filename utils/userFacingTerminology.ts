export const sanitizeUserFacingTerminology = (value: unknown): string => {
  const original = String(value ?? '');
  if (!original) return original;

  const leadingWhitespace = original.match(/^\s*/)?.[0] || '';
  const trailingWhitespace = original.match(/\s*$/)?.[0] || '';
  let text = original.trim();
  if (!text) return original;

  text = text
    .replace(/\bQFI\b/gi, 'Instructor')
    .replace(/\bSPT\b/gi, 'Trainee')
    .replace(/\bFTD[\s-]*(?=\d)/gi, 'Simulator ')
    .replace(/\bFTD[\s-]*(?=STBY\b)/gi, 'Simulator ')
    .replace(/\bFTD\b/gi, 'Simulator');

  return `${leadingWhitespace}${text.replace(/[ \t]{2,}/g, ' ')}${trailingWhitespace}`;
};
