export type PersonIdentityRecord = {
  id?: string | number | null;
  idNumber?: string | number | null;
  name?: string | null;
  fullName?: string | null;
  rank?: string | null;
  role?: string | null;
  course?: string | null;
  unit?: string | null;
};

export const normalisePersonName = (value: unknown): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const getPersonDisplayName = (person: PersonIdentityRecord): string =>
  String(person.fullName || person.name || '').trim();

const stripPersonContext = (value: unknown): string =>
  String(value || '').split(' – ')[0].split(' - ')[0].trim();

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
  const personByName = new Map<string, PersonIdentityRecord[]>();
  const surnameCounts = new Map<string, number>();
  const surnameInitialCounts = new Map<string, number>();
  const surnameFirstNameCounts = new Map<string, number>();

  people.forEach(person => {
    const displayName = getPersonDisplayName(person);
    const { surname, firstName, firstInitial } = getNameParts(displayName);
    const nameKey = normalisePersonName(displayName);
    const surnameKey = normalisePersonName(surname);
    const initialKey = `${surnameKey}|${firstInitial}`;
    const firstNameKey = `${surnameKey}|${normalisePersonName(firstName)}`;
    if (nameKey) personByName.set(nameKey, [...(personByName.get(nameKey) || []), person]);
    if (surnameKey) surnameCounts.set(surnameKey, (surnameCounts.get(surnameKey) || 0) + 1);
    if (surnameKey && firstInitial) surnameInitialCounts.set(initialKey, (surnameInitialCounts.get(initialKey) || 0) + 1);
    if (surnameKey && firstName) surnameFirstNameCounts.set(firstNameKey, (surnameFirstNameCounts.get(firstNameKey) || 0) + 1);
  });

  const findPerson = (name: unknown): PersonIdentityRecord | undefined => {
    const key = normalisePersonName(stripPersonContext(name));
    const matches = key ? personByName.get(key) || [] : [];
    return matches[0];
  };

  const formatCompact = (name: unknown): string => {
    const cleaned = stripPersonContext(name);
    if (!cleaned) return '';
    const person = findPerson(cleaned);
    const { surname, firstInitial } = getNameParts(cleaned);
    const surnameKey = normalisePersonName(surname);
    const initialKey = `${surnameKey}|${firstInitial}`;
    if (!surnameKey || (surnameCounts.get(surnameKey) || 0) <= 1) return surname || cleaned;
    const base = [surname, firstInitial].filter(Boolean).join(' ');
    if ((surnameInitialCounts.get(initialKey) || 0) <= 1) return base || surname || cleaned;
    const suffix = getLastThreeIdDigits(person);
    return suffix ? `${base} · ${suffix}` : base || surname || cleaned;
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

  return { formatCompact, formatList };
};
