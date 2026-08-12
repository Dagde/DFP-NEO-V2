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

export const samePersonRecord = (left: PersonIdentityRecord, right: PersonIdentityRecord): boolean => {
  const leftId = String(left.id || '').trim();
  const rightId = String(right.id || '').trim();
  if (leftId && rightId) return leftId === rightId;
  const leftIdNumber = String(left.idNumber || '').trim();
  const rightIdNumber = String(right.idNumber || '').trim();
  return Boolean(leftIdNumber && rightIdNumber && leftIdNumber === rightIdNumber);
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
