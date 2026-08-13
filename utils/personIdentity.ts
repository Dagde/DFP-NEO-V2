export type PersonIdentityRecord = {
  id?: string | number | null;
  idNumber?: string | number | null;
  name?: string | null;
  fullName?: string | null;
  rank?: string | null;
  role?: string | null;
  course?: string | null;
  unit?: string | null;
  personType?: string | null;
};

export type CompactPersonNameExplanation = {
  input: string;
  cleaned: string;
  visualSuffix: string;
  matchedPerson: (PersonIdentityRecord & { displayName: string; lastThreeIdDigits: string }) | null;
  resolvedDisplayName: string;
  surname: string;
  firstName: string;
  firstInitial: string;
  surnameCount: number;
  exactNameCount: number;
  duplicateMatches: Array<PersonIdentityRecord & { displayName: string; lastThreeIdDigits: string }>;
  base: string;
  suffix: string;
  output: string;
  decision: 'empty' | 'unique-surname' | 'same-surname-only' | 'exact-duplicate' | 'exact-duplicate-without-id';
};

export const normalisePersonName = (value: unknown): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const getPersonDisplayName = (person: PersonIdentityRecord): string =>
  String(person.fullName || person.name || '').trim();

const stripPersonContext = (value: unknown): string =>
  String(value || '')
    .split(' – ')[0]
    .split(' - ')[0]
    .replace(/\s*·\s*\d{1,3}(?=\s*(?:\(|$))/g, '')
    .replace(/\s+\((?:N|F\/S|F\/L|R\/S)\)$/i, '')
    .trim();

const getVisualIdSuffix = (value: unknown): string => {
  const match = String(value || '').match(/\s·\s*(\d{1,3})(?=\s*(?:\(|$))/);
  return match?.[1] || '';
};

const getNameParts = (value: unknown): { surname: string; firstName: string; firstInitial: string; displayName: string } => {
  const displayName = stripPersonContext(value);
  if (!displayName) return { surname: '', firstName: '', firstInitial: '', displayName: '' };
  if (displayName.includes(',')) {
    const [surnamePart, givenPart = ''] = displayName.split(',');
    const firstName = givenPart.trim().split(/\s+/).filter(Boolean)[0] || '';
    return {
      surname: surnamePart.trim(),
      firstName,
      firstInitial: firstName.charAt(0).toUpperCase(),
      displayName,
    };
  }
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && /^[A-Z]$/i.test(parts[1])) {
    return {
      surname: parts[0],
      firstName: '',
      firstInitial: parts[1].toUpperCase(),
      displayName,
    };
  }
  const surname = parts.length > 1 ? parts[parts.length - 1] : displayName;
  const firstName = parts.length > 1 ? parts[0] : '';
  const firstInitial = firstName.charAt(0).toUpperCase();
  return { surname, firstName, firstInitial, displayName };
};

const getLastThreeIdDigits = (person?: PersonIdentityRecord): string => {
  const digits = String(person?.idNumber || '').replace(/\D/g, '');
  return digits ? digits.slice(-3).padStart(Math.min(3, digits.length), '0') : '';
};

export const samePersonRecord = (left: PersonIdentityRecord, right: PersonIdentityRecord): boolean => {
  const leftId = String(left.id || '').trim();
  const rightId = String(right.id || '').trim();
  if (leftId && rightId) return leftId === rightId;
  const leftIdNumber = String(left.idNumber || '').trim();
  const rightIdNumber = String(right.idNumber || '').trim();
  return Boolean(leftIdNumber && rightIdNumber && leftIdNumber === rightIdNumber);
};

export const getPersonStableKey = (person: PersonIdentityRecord, fallbackPrefix = 'person'): string => {
  const id = String(person.id || '').trim();
  if (id) return `db-${id}`;
  const idNumber = String(person.idNumber || '').trim();
  if (idNumber) return `pid-${idNumber}`;
  const name = getPersonDisplayName(person);
  const context = [person.unit, person.course, person.role].map(value => String(value || '').trim()).filter(Boolean).join('|');
  return `${fallbackPrefix}-${name || 'unnamed'}${context ? `-${context}` : ''}`;
};

export const getPersonDomIdSuffix = (person: PersonIdentityRecord, fallbackPrefix = 'person'): string =>
  getPersonStableKey(person, fallbackPrefix).replace(/[^A-Za-z0-9_-]+/g, '-');

export const getPersonIdentityDedupeKey = (person: PersonIdentityRecord, fallbackPrefix = 'person'): string => {
  const idNumber = String(person.idNumber || '').trim();
  if (idNumber) return `pid-${idNumber}`;
  return getPersonStableKey(person, fallbackPrefix);
};

export const formatPersonOptionLabel = (person: PersonIdentityRecord): string => {
  const name = getPersonDisplayName(person) || 'Unnamed person';
  const parts = [
    person.rank,
    name,
    person.role || person.course,
    person.unit,
    person.idNumber ? `ID ${person.idNumber}` : '',
  ].map(value => String(value || '').trim()).filter(Boolean);
  return parts.join(' - ');
};

export const describeDuplicateNamePerson = (person: PersonIdentityRecord): string => {
  const parts = [
    formatPersonOptionLabel(person),
  ].filter(Boolean);
  return parts.join('');
};

export const buildCompactPersonNameResolver = (people: PersonIdentityRecord[] = []) => {
  const uniquePeople = people.filter((person, index, source) => {
    const key = getPersonIdentityDedupeKey(person);
    return source.findIndex(candidate => getPersonIdentityDedupeKey(candidate) === key) === index;
  });
  const personByName = new Map<string, PersonIdentityRecord[]>();
  const surnameCounts = new Map<string, number>();
  const surnameFirstNameCounts = new Map<string, number>();

  uniquePeople.forEach(person => {
    const displayName = getPersonDisplayName(person);
    const { surname, firstName } = getNameParts(displayName);
    const nameKey = normalisePersonName(stripPersonContext(displayName));
    const surnameKey = normalisePersonName(surname);
    const firstNameKey = `${surnameKey}|${normalisePersonName(firstName)}`;
    if (nameKey) personByName.set(nameKey, [...(personByName.get(nameKey) || []), person]);
    if (!firstName) return;
    if (surnameKey) surnameCounts.set(surnameKey, (surnameCounts.get(surnameKey) || 0) + 1);
    if (surnameKey && firstName) surnameFirstNameCounts.set(firstNameKey, (surnameFirstNameCounts.get(firstNameKey) || 0) + 1);
  });

  const findPerson = (name: unknown): PersonIdentityRecord | undefined => {
    const key = normalisePersonName(stripPersonContext(name));
    const matches = key ? personByName.get(key) || [] : [];
    if (matches[0]) return matches[0];
    const visualSuffix = getVisualIdSuffix(name);
    if (!visualSuffix) return undefined;
    const { surname, firstInitial } = getNameParts(name);
    const surnameKey = normalisePersonName(surname);
    return uniquePeople.find(person => {
      const personSuffix = getLastThreeIdDigits(person);
      if (!personSuffix || personSuffix !== visualSuffix) return false;
      const parts = getNameParts(getPersonDisplayName(person));
      return normalisePersonName(parts.surname) === surnameKey && (!firstInitial || parts.firstInitial === firstInitial);
    });
  };

  const explainCompact = (name: unknown): CompactPersonNameExplanation => {
    const input = String(name || '');
    const cleaned = stripPersonContext(name);
    const visualSuffix = getVisualIdSuffix(name);
    if (!cleaned) {
      return {
        input,
        cleaned: '',
        visualSuffix,
        matchedPerson: null,
        resolvedDisplayName: '',
        surname: '',
        firstName: '',
        firstInitial: '',
        surnameCount: 0,
        exactNameCount: 0,
        duplicateMatches: [],
        base: '',
        suffix: '',
        output: '',
        decision: 'empty',
      };
    }
    const person = findPerson(name);
    const displayName = person ? getPersonDisplayName(person) : cleaned;
    const { surname, firstName, firstInitial } = getNameParts(displayName);
    const surnameKey = normalisePersonName(surname);
    const firstNameKey = `${surnameKey}|${normalisePersonName(firstName)}`;
    const surnameCount = surnameCounts.get(surnameKey) || 0;
    const exactNameCount = surnameFirstNameCounts.get(firstNameKey) || 0;
    const base = [surname, firstInitial].filter(Boolean).join(' ');
    const matchedPerson = person ? {
      ...person,
      displayName: getPersonDisplayName(person),
      lastThreeIdDigits: getLastThreeIdDigits(person),
    } : null;
    const duplicateMatches = uniquePeople
      .filter(candidate => {
        const parts = getNameParts(getPersonDisplayName(candidate));
        return normalisePersonName(parts.surname) === surnameKey &&
          normalisePersonName(parts.firstName) === normalisePersonName(firstName) &&
          Boolean(parts.firstName);
      })
      .map(candidate => ({
        ...candidate,
        displayName: getPersonDisplayName(candidate),
        lastThreeIdDigits: getLastThreeIdDigits(candidate),
      }));
    if (!surnameKey || surnameCount <= 1) {
      return {
        input,
        cleaned,
        visualSuffix,
        matchedPerson,
        resolvedDisplayName: displayName,
        surname,
        firstName,
        firstInitial,
        surnameCount,
        exactNameCount,
        duplicateMatches,
        base,
        suffix: '',
        output: surname || cleaned,
        decision: 'unique-surname',
      };
    }
    if (exactNameCount <= 1) {
      return {
        input,
        cleaned,
        visualSuffix,
        matchedPerson,
        resolvedDisplayName: displayName,
        surname,
        firstName,
        firstInitial,
        surnameCount,
        exactNameCount,
        duplicateMatches,
        base,
        suffix: '',
        output: base || surname || cleaned,
        decision: 'same-surname-only',
      };
    }
    const suffix = getLastThreeIdDigits(person);
    return {
      input,
      cleaned,
      visualSuffix,
      matchedPerson,
      resolvedDisplayName: displayName,
      surname,
      firstName,
      firstInitial,
      surnameCount,
      exactNameCount,
      duplicateMatches,
      base,
      suffix,
      output: suffix ? `${base} · ${suffix}` : base || surname || cleaned,
      decision: suffix ? 'exact-duplicate' : 'exact-duplicate-without-id',
    };
  };

  const formatCompact = (name: unknown): string => {
    return explainCompact(name).output;
  };

  const formatList = (person: PersonIdentityRecord): string => {
    const displayName = stripPersonContext(person.name || getPersonDisplayName(person)) || 'Unnamed person';
    const { surname, firstName } = getNameParts(displayName);
    const surnameKey = normalisePersonName(surname);
    const firstNameKey = `${surnameKey}|${normalisePersonName(firstName)}`;
    if ((surnameFirstNameCounts.get(firstNameKey) || 0) <= 1) return displayName;
    const suffix = getLastThreeIdDigits(person);
    return suffix ? `${displayName} · ${suffix}` : displayName;
  };

  return { formatCompact, formatList, explainCompact };
};
