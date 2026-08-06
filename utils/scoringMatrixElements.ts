import type { PhraseBank } from '../types';

export const INITIAL_SCORING_MATRIX_ELEMENTS = [
  'Generic Flying Elements',
  'Airmanship',
  'Preparation',
  'Technique',
  'Pre-Post Flight',
  'Walk Around',
  'Strap-in',
  'Ground Checks',
  'Airborne Checks',
  'Stationary',
  'Visual',
  'Effects of Control',
  'Trimming',
  'Straight and Level',
  'Level medium Turn',
  'Level Steep turn',
  'Visual - Initial & Pitch',
  'Landing',
  'Crosswind',
  'Radio Comms',
  'Situational Awareness',
  'Lookout',
  'Knowledge',
];

export const SCORING_MATRIX_ELEMENT_LIST_KEY = '__scoringMatrixElements';
export const SCORING_MATRIX_ELEMENT_GROUPS_KEY = '__scoringMatrixElementGroups';

export const DEFAULT_SCORING_MATRIX_SECTIONS = [
  'Core Dimensions',
  'Procedural Framework',
  'Takeoff',
  'Departure',
  'Core Handling Skills',
  'Turns',
  'Recovery',
  'Landing',
  'Domestics',
  'Additional Elements',
];

export const DEFAULT_SCORING_MATRIX_ELEMENT_GROUPS: Record<string, string> = {
  Airmanship: 'Core Dimensions',
  Preparation: 'Core Dimensions',
  Technique: 'Core Dimensions',
  'Pre-Post Flight': 'Procedural Framework',
  'Walk Around': 'Procedural Framework',
  'Strap-in': 'Procedural Framework',
  'Ground Checks': 'Procedural Framework',
  'Airborne Checks': 'Procedural Framework',
  Stationary: 'Takeoff',
  Visual: 'Departure',
  'Effects of Control': 'Core Handling Skills',
  Trimming: 'Core Handling Skills',
  'Straight and Level': 'Core Handling Skills',
  'Level medium Turn': 'Turns',
  'Level Steep turn': 'Turns',
  'Visual - Initial & Pitch': 'Recovery',
  Landing: 'Landing',
  Crosswind: 'Landing',
  'Radio Comms': 'Domestics',
  'Situational Awareness': 'Domestics',
  Lookout: 'Domestics',
  Knowledge: 'Domestics',
};

export const SCORING_MATRIX_SECTION_HELP = 'Choose where this element appears in the training report. Type a new section name to add it. A section stays in the dropdown while at least one element uses it. To rename a section, change each element using the old name to the new name.';

export const normaliseScoringMatrixElementName = (value: unknown): string => String(value || '').trim();

export const dedupeScoringMatrixElements = (elements: unknown[]): string[] => elements
  .map(normaliseScoringMatrixElementName)
  .filter(Boolean)
  .filter((element, index, all) => (
    all.findIndex((candidate) => candidate.toLowerCase() === element.toLowerCase()) === index
  ));

export const getConfiguredScoringMatrixElements = (phraseBank: PhraseBank | Record<string, any> | null | undefined): string[] => {
  const savedElements = (phraseBank as any)?.[SCORING_MATRIX_ELEMENT_LIST_KEY];
  if (Array.isArray(savedElements)) {
    return dedupeScoringMatrixElements(savedElements);
  }
  const customElements = Object.keys(phraseBank || {}).filter((key) => (
    key !== SCORING_MATRIX_ELEMENT_LIST_KEY
    && key !== SCORING_MATRIX_ELEMENT_GROUPS_KEY
    && !INITIAL_SCORING_MATRIX_ELEMENTS.includes(key)
  ));
  return dedupeScoringMatrixElements([...INITIAL_SCORING_MATRIX_ELEMENTS, ...customElements]);
};

export const getConfiguredScoringMatrixElementGroups = (phraseBank: PhraseBank | Record<string, any> | null | undefined): {
  groups: Record<string, string>;
  hasExplicitGroups: boolean;
} => {
  const savedGroups = (phraseBank as any)?.[SCORING_MATRIX_ELEMENT_GROUPS_KEY];
  const hasExplicitGroups = !!savedGroups && typeof savedGroups === 'object' && !Array.isArray(savedGroups);
  return {
    groups: hasExplicitGroups ? savedGroups as Record<string, string> : {},
    hasExplicitGroups,
  };
};

export const getScoringMatrixElementGroup = (
  element: string,
  groups: Record<string, string>,
  hasExplicitGroups: boolean,
): string => {
  if (Object.prototype.hasOwnProperty.call(groups, element)) {
    return String(groups[element] || '').trim() || 'Additional Elements';
  }
  if (!hasExplicitGroups) {
    return DEFAULT_SCORING_MATRIX_ELEMENT_GROUPS[element] || 'Additional Elements';
  }
  return 'Additional Elements';
};
