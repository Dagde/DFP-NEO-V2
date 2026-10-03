import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';

const prisma = new PrismaClient();
const db = prisma as any;

const REQUIRED_COLUMNS = [
  'Type',
];

const SYLLABUS_COURSE_SHELL_NOTE = '[DFP_COURSE_SHELL]';

const UPLOAD_TYPE_LABELS = new Set([
  'flight',
  'flying',
  'ftd',
  'sim',
  'simulator',
  'procedural trainer',
  'procedural training',
  'academics',
  'academic',
  'ground',
  'ground school',
  'cpt',
  'tut',
  'tutorial',
  'brief',
  'mass brief',
]);

const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
const ALLOWED_WORKBOOK_EXTENSIONS = new Set(['.xlsx', '.xls']);

const BLOCKED_WORKBOOK_INDICATORS = [
  { token: 'vbaproject.bin', reason: 'The workbook contains macro content.' },
  { token: 'xl/embeddings/', reason: 'The workbook contains embedded objects.' },
  { token: 'xl/activexcontrols/', reason: 'The workbook contains ActiveX controls.' },
  { token: 'xl/externallinks/', reason: 'The workbook contains external workbook links.' },
  { token: 'application/vnd.ms-office.activex', reason: 'The workbook contains ActiveX content.' },
];

const getWorkbookExtension = (fileName = '') => {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] || '';
};

const hasZipWorkbookSignature = (buffer: Buffer) => (
  buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
);

const hasLegacyExcelSignature = (buffer: Buffer) => {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);
};

const validateWorkbookUploadFile = (file: File, buffer: Buffer): string => {
  if (!buffer.length) return 'No upload file data was supplied.';
  if (buffer.length > MAX_WORKBOOK_BYTES) return 'The upload file is too large. The maximum workbook size is 10 MB.';

  const extension = getWorkbookExtension(file.name || '');
  if (!ALLOWED_WORKBOOK_EXTENSIONS.has(extension)) {
    if (extension === '.xlsm') return 'Macro-enabled Excel files are not accepted for syllabus uploads. Save the workbook as .xlsx and upload again.';
    return 'Only Excel workbook files can be uploaded.';
  }
  if (extension === '.xlsx' && !hasZipWorkbookSignature(buffer)) {
    return 'The uploaded workbook does not look like a valid XLSX file.';
  }
  if (extension === '.xls' && !hasLegacyExcelSignature(buffer) && !hasZipWorkbookSignature(buffer)) {
    return 'The uploaded XLS file does not look like a valid Excel workbook.';
  }

  const searchable = buffer.toString('latin1').toLowerCase();
  for (const indicator of BLOCKED_WORKBOOK_INDICATORS) {
    if (searchable.includes(indicator.token)) return indicator.reason;
  }
  if (extension === '.xls' && ['_vba_project', 'vba', 'macrosheet'].some((indicator) => searchable.includes(indicator))) {
    return 'The legacy XLS workbook appears to contain macro content.';
  }
  return '';
};

const getValue = (row: Record<string, any>, aliases: string[]): any => {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }

  const normalisedAliases = aliases.map(alias => alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const key = Object.keys(row).find(candidate =>
    normalisedAliases.includes(candidate.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );
  return key ? row[key] : undefined;
};

const getString = (row: Record<string, any>, aliases: string[]): string => {
  const value = getValue(row, aliases);
  return value === undefined || value === null ? '' : String(value).trim();
};

const getNumber = (row: Record<string, any>, aliases: string[]): number | undefined => {
  const value = getValue(row, aliases);
  if (value === undefined || value === null || value === '') return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const hasAnyString = (row: Record<string, any>, aliases: string[]): boolean =>
  Boolean(getString(row, aliases));

const getList = (row: Record<string, any>, aliases: string[]): string[] => {
  const value = getValue(row, aliases);
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|;/)
    .map(item => item.trim())
    .filter(Boolean);
};

const normaliseType = (value: string): string => {
  const cleanValue = value.trim().toLowerCase();
  if (cleanValue === 'flight' || cleanValue === 'flying') return 'Flight';
  if (cleanValue === 'ftd' || cleanValue === 'sim' || cleanValue === 'simulator' || cleanValue === 'procedural trainer' || cleanValue === 'procedural training') return 'FTD';
  if (cleanValue === 'academics' || cleanValue === 'academic') return 'Academics';
  if (cleanValue === 'ground' || cleanValue === 'ground school' || cleanValue === 'cpt' || cleanValue === 'tut' || cleanValue === 'tutorial' || cleanValue === 'brief' || cleanValue === 'mass brief') return 'Ground School';
  return value || 'Ground School';
};

const normaliseLmpTestEventType = (value: string): 'NONE' | 'FLIGHT_TEST' | 'SIMULATOR_TEST' => {
  const cleanValue = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (!cleanValue || cleanValue === 'none' || cleanValue === 'not a test' || cleanValue === 'not a test event') return 'NONE';
  if (cleanValue === 'flight test' || cleanValue === 'flight' || cleanValue === 'flt test') return 'FLIGHT_TEST';
  if (cleanValue === 'simulator test' || cleanValue === 'sim test' || cleanValue === 'sim' || cleanValue === 'ftd test') return 'SIMULATOR_TEST';
  return 'NONE';
};

const normaliseTestingOfficerQualification = (value: string): string | null => {
  const cleanValue = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (!cleanValue) return null;
  if (cleanValue === 'testing officer' || cleanValue === 'test officer' || cleanValue === 'testing officer qualification' || cleanValue === 'testing officer qual' || cleanValue === 'testing officer qn' || cleanValue === 'testing officer q') return 'testing-officer';
  if (cleanValue === 'qfi') return 'qfi';
  if (cleanValue === 'ire') return 'ire';
  if (cleanValue === 'testing officer id' || cleanValue === 'testing officer id testing officer') return 'testing-officer';
  return null;
};

const parseBooleanUploadValue = (value: string): boolean => {
  const cleanValue = value.trim().toLowerCase();
  return ['yes', 'y', 'true', '1', 'use', 'use secondary', 'secondary', 'secondary callsign'].includes(cleanValue);
};

const getRequiredUploadDataErrors = (row: Record<string, any>): string[] => {
  const errors: string[] = [];
  const missingColumns = REQUIRED_COLUMNS.filter(column => !getString(row, [column]));
  if (missingColumns.length > 0) errors.push(`Missing required fields: ${missingColumns.join(', ')}`);

  if (!hasAnyString(row, ['Event description', 'Event Description', 'Event Title', 'Title', 'Description'])) {
    errors.push('Missing required fields: Event description or Event Title');
  }

  const typeValue = getString(row, ['Type']);
  if (typeValue && !UPLOAD_TYPE_LABELS.has(typeValue.trim().toLowerCase())) {
    errors.push(`Type must be one of: Flight, Simulator, Procedural Trainer, Academics, Ground School, CPT`);
  }

  const flightOrSimHours = getNumber(row, ['Flight or Sim Hours', 'flightOrSimHours']);
  const totalEventHours = getNumber(row, ['Total Event Hours', 'Total Event Hrs', 'totalEventHours']);
  const duration = flightOrSimHours ?? totalEventHours;
  if (!(Number.isFinite(duration) && Number(duration) > 0)) {
    errors.push('Missing required duration: enter a positive value in Flight or Sim Hours or Total Event Hours');
  }

  return errors;
};

const normaliseDayNight = (value: string): 'Day' | 'Night' | 'Day/Night' => {
  const cleanValue = value.trim().toLowerCase();
  if (cleanValue === 'night') return 'Night';
  if (cleanValue === 'day/night' || cleanValue === 'day night' || cleanValue === 'daynight') return 'Day/Night';
  return 'Day';
};

const normaliseSortieType = (value: string): 'Dual' | 'Solo' | null => {
  const cleanValue = value.trim().toLowerCase();
  if (cleanValue === 'solo') return 'Solo';
  if (cleanValue === 'dual') return 'Dual';
  return null;
};

const normaliseAircraftConfigs = (value: string): string[] => {
  const configs = value
    .split(/\r?\n|;|,/)
    .map(config => config.trim().toUpperCase())
    .filter(Boolean)
    .map(config => {
      if (config === 'ANY') return 'ANY';
      const numeric = config.match(/^(?:CONFIG[\s-]*|C\s*)?(\d+)$/);
      return numeric ? `CONFIG-${numeric[1]}` : config.replace(/^CONFIG\s+/, 'CONFIG-');
    });
  return configs.length > 0 ? Array.from(new Set(configs)) : ['ANY'];
};

const getNormalisedLmpType = (value: string | null | undefined): 'Staff CAT' | 'Master LMP' =>
  value === 'Staff CAT' ? 'Staff CAT' : 'Master LMP';

const getGeneratedCodePrefix = (courseCode: string): string => {
  const cleanPrefix = courseCode.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  return cleanPrefix || 'PKG';
};

const getGeneratedEventCode = (courseCode: string, sequence: number): string =>
  `${getGeneratedCodePrefix(courseCode)}${String(sequence).padStart(2, '0')}`;

const getPackageCodeFromTitle = (title: string): string => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.length === 1
    ? words[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    : words.map(word => word[0].toUpperCase()).join('').replace(/[^A-Z0-9]/g, '').slice(0, 8);
};

const getUnitScopedCollectionCode = (baseCode: string, unitCode: string): string => {
  const cleanBase = String(baseCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanUnit = String(unitCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cleanBase) return '';
  if (!cleanUnit || cleanBase === cleanUnit || cleanBase.startsWith(`${cleanUnit}-`)) return cleanBase;
  return `${cleanUnit}-${cleanBase}`.slice(0, 24);
};

const rowHasContent = (row: Record<string, any>): boolean =>
  Object.values(row).some(value => value !== undefined && value !== null && String(value).trim() !== '');

const rowHasUploadEventContent = (row: Record<string, any>): boolean => {
  if (!rowHasContent(row)) return false;
  return Boolean(
    getString(row, ['Event Code', 'Code', 'Event ID', 'Event Number'])
    || getString(row, ['Event description', 'Event Description', 'Event Title', 'Title', 'Description', 'eventDescription'])
    || getString(row, ['Type'])
    || getString(row, ['Course', 'Package'])
  );
};

const getWorksheetCellText = (cell: any): string => String(cell?.w ?? cell?.v ?? '').trim();

const getColourKey = (color: any): string => {
  if (!color) return '';
  if (color.rgb) return `rgb:${String(color.rgb).toUpperCase()}`;
  if (color.indexed !== undefined) return `indexed:${color.indexed}`;
  if (color.theme !== undefined) return `theme:${color.theme}`;
  return '';
};

const getStyleColourKey = (cell: any): string => {
  const fontColour = getColourKey(cell?.s?.font?.color);
  if (fontColour) return `font:${fontColour}`;
  const fillColour = getColourKey(cell?.s?.fgColor);
  if (fillColour) return `fill:${fillColour}`;
  if (cell?.s?.fillId !== undefined) return `fillid:${cell.s.fillId}`;
  if (cell?.s?.fillid !== undefined) return `fillid:${cell.s.fillid}`;
  return '';
};

const workbookHasItalicFont = (workbook: any): boolean =>
  Array.isArray(workbook?.Styles?.Fonts) && workbook.Styles.Fonts.some((font: any) => Boolean(font?.italic));

const isStyledExampleSecondRow = (worksheet: any, workbook: any): boolean => {
  const range = worksheet?.['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
  if (!range) return false;
  const headerRow = range.s.r;
  const exampleRow = headerRow + 1;
  let populatedCellCount = 0;
  let italicCellCount = 0;
  let differingColourCellCount = 0;
  const hasWorkbookItalicStyle = workbookHasItalicFont(workbook);

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: headerRow, c: column })];
    const exampleCell = worksheet[XLSX.utils.encode_cell({ r: exampleRow, c: column })];
    if (!getWorksheetCellText(exampleCell)) continue;
    populatedCellCount += 1;
    if (exampleCell?.s?.font?.italic || hasWorkbookItalicStyle) italicCellCount += 1;
    const headerColour = getStyleColourKey(headerCell);
    const exampleColour = getStyleColourKey(exampleCell);
    if (headerColour && headerColour !== exampleColour) differingColourCellCount += 1;
  }

  if (populatedCellCount === 0) return false;
  return italicCellCount / populatedCellCount >= 0.75 && differingColourCellCount / populatedCellCount >= 0.5;
};

const normaliseContextCode = (value: unknown): string => String(value || '').trim().toUpperCase();
const lmpTypeIsNotStaffCat = (value: unknown): boolean => getNormalisedLmpType(String(value || '')) !== 'Staff CAT';

const staffCatItemMatchesUploadContext = (
  item: any,
  operationalModel: string,
  locationCode: string,
  unitCode: string,
): boolean => {
  if (lmpTypeIsNotStaffCat(item?.lmpType)) return true;
  const model = normaliseContextCode(operationalModel);
  const itemLocation = normaliseContextCode(item?.location);
  const itemUnit = normaliseContextCode(item?.unit);
  const targetLocation = normaliseContextCode(locationCode);
  const targetUnit = normaliseContextCode(unitCode);
  if (model === 'FIXED_CREW') {
    return Boolean(targetUnit) && itemUnit === targetUnit && (!targetLocation || !itemLocation || itemLocation === targetLocation);
  }
  if (model === 'AIR_COMBAT') {
    return (!targetUnit || !itemUnit || itemUnit === targetUnit) && (!targetLocation || !itemLocation || itemLocation === targetLocation);
  }
  return true;
};

const belongsToDestination = (
  item: any,
  courseCode: string,
  lmpType: 'Staff CAT' | 'Master LMP',
  operationalModel = '',
  locationCode = '',
  unitCode = '',
): boolean => {
  const courses = Array.isArray(item?.courses) ? item.courses : [];
  return getNormalisedLmpType(item?.lmpType) === lmpType
    && courses.includes(courseCode)
    && (lmpType !== 'Staff CAT' || staffCatItemMatchesUploadContext(item, operationalModel, locationCode, unitCode));
};

const isCourseShellRow = (item: any): boolean => (
  String(item?.notes || '').includes(SYLLABUS_COURSE_SHELL_NOTE)
);

const getIndividualMasterEventId = (item: any): string => String(item?.masterEventId || item?.id || item?.code || '').trim();

const getEventIdentityKeys = (item: any): string[] => Array.from(new Set([
  item?.masterEventId,
  item?.id,
  item?.code,
].map(value => String(value || '').trim()).filter(Boolean)));

const itemMatchesAnyKey = (item: any, keys: Set<string>): boolean =>
  getEventIdentityKeys(item).some(key => keys.has(key));

const isIndividualEventComplete = (item: any, completedIds: Set<string>): boolean => {
  const identifiers = [
    item?.id,
    item?.code,
    item?.masterEventId,
  ].map(value => String(value || '').trim()).filter(Boolean);
  return Boolean(item?.completedAt || item?.isComplete || item?.completed || item?.rplGranted || identifiers.some(id => completedIds.has(id)));
};

const stampMasterLmpItemsForIndividual = (masterSyllabus: any[]): any[] =>
  masterSyllabus.map((item, index) => ({
    ...item,
    masterEventId: String(item?.id || item?.code || '').trim(),
    lmpSource: 'master',
    orderKey: item?.orderKey || String(index + 1).padStart(5, '0'),
    placementNeedsReview: false,
  }));

const mergeUpdatedMasterIntoIndividualLmp = (
  existingEvents: any[],
  masterSyllabus: any[],
  completedEventIds: string[],
): { events: any[]; meta: Record<string, any> } => {
  const completedIds = new Set((completedEventIds || []).map(value => String(value || '').trim()).filter(Boolean));
  const existing = Array.isArray(existingEvents) ? existingEvents : [];
  const existingByMasterId = new Map<string, any>();
  const existingByCode = new Map<string, any>();

  existing.forEach((item) => {
    const masterId = getIndividualMasterEventId(item);
    if (masterId) existingByMasterId.set(masterId, item);
    const code = String(item?.code || '').trim();
    if (code) existingByCode.set(code, item);
  });

  const stampedMaster = stampMasterLmpItemsForIndividual(masterSyllabus);
  const existingCompletedByNewMasterIndex = stampedMaster.map((masterItem, index) => {
    const masterId = getIndividualMasterEventId(masterItem);
    const existingItem = existingByMasterId.get(masterId) || existingByCode.get(String(masterItem?.code || '').trim());
    return {
      index,
      masterItem,
      existingItem,
      isComplete: existingItem ? isIndividualEventComplete(existingItem, completedIds) : isIndividualEventComplete(masterItem, completedIds),
    };
  });

  const lastCompletedInNewMaster = existingCompletedByNewMasterIndex
    .filter(item => item.isComplete)
    .reduce((max, item) => Math.max(max, item.index), -1);

  const lastCompletedMaster = lastCompletedInNewMaster >= 0 ? stampedMaster[lastCompletedInNewMaster] : null;
  const lastCompletedKeys = new Set(getEventIdentityKeys(lastCompletedMaster || {}));
  const lastCompletedExistingIndex = lastCompletedKeys.size > 0
    ? existing.findIndex(item => itemMatchesAnyKey(item, lastCompletedKeys))
    : existing.reduce((lastIndex, item, index) => isIndividualEventComplete(item, completedIds) ? index : lastIndex, -1);

  const protectedPrefix = lastCompletedExistingIndex >= 0
    ? existing.slice(0, lastCompletedExistingIndex + 1).map((item, index) => ({
        ...item,
        orderKey: String(index + 1).padStart(5, '0'),
      }))
    : [];
  const protectedKeys = new Set(protectedPrefix.flatMap(getEventIdentityKeys));
  const futureMaster = stampedMaster.slice(lastCompletedInNewMaster + 1);
  const futureMasterKeys = new Set(futureMaster.flatMap(getEventIdentityKeys));

  const rebuiltFuture = futureMaster
    .filter(masterItem => !itemMatchesAnyKey(masterItem, protectedKeys))
    .map((masterItem, index) => {
      const masterId = getIndividualMasterEventId(masterItem);
      const existingItem = existingByMasterId.get(masterId) || existingByCode.get(String(masterItem?.code || '').trim());
      return {
        ...masterItem,
        completedAt: existingItem?.completedAt ?? null,
        userLockedPosition: existingItem?.userLockedPosition,
        orderKey: String(protectedPrefix.length + index + 1).padStart(5, '0'),
      };
    });

  const overlaysAndRemovedCompleted = existing
    .slice(Math.max(lastCompletedExistingIndex + 1, 0))
    .filter((item) => {
      const isOverlay = item?.lmpSource === 'remedial' || item?.lmpSource === 'custom' || item?.isRemedial === true;
      if (isOverlay) return true;
      if (itemMatchesAnyKey(item, futureMasterKeys)) return false;
      return isIndividualEventComplete(item, completedIds);
    })
    .map((item, index) => ({
      ...item,
      orderKey: `${String(protectedPrefix.length + rebuiltFuture.length + index + 1).padStart(5, '0')}.900`,
      placementNeedsReview: true,
    }));

  const events = [...protectedPrefix, ...rebuiltFuture, ...overlaysAndRemovedCompleted];
  return {
    events,
    meta: {
      lastCompletedEventCode: lastCompletedMaster?.code || protectedPrefix[protectedPrefix.length - 1]?.code || null,
      lastCompletedNewMasterIndex: lastCompletedInNewMaster,
      protectedPrefixEvents: protectedPrefix.length,
      ignoredUploadedHistoricalEvents: Math.max(lastCompletedInNewMaster + 1, 0),
      futureEventsFromUpdatedMaster: rebuiltFuture.length,
      carriedForwardReviewEvents: overlaysAndRemovedCompleted.length,
      beforeEvents: existing.length,
      afterEvents: events.length,
    },
  };
};

const getAssignedTraineeWhere = (courseCode: string, locationCode = '', unitCode = '') => ({
  isActive: true,
  OR: [
    { lmpType: courseCode },
    { academicLmpType: courseCode },
    { course: courseCode },
  ],
  ...(unitCode ? { unit: unitCode } : {}),
  ...(locationCode ? { location: locationCode } : {}),
});

const summariseIndividualUpdateImpact = async (courseCode: string, locationCode = '', unitCode = '') => {
  const trainees = await db.trainee.findMany({
    where: getAssignedTraineeWhere(courseCode, locationCode, unitCode),
    include: { individualLMP: true },
  });
  let protectedCompletedEvents = 0;
  let ignoredUploadedHistoricalEvents = 0;
  let futureEventsFromUpdatedMaster = 0;
  trainees.forEach((trainee: any) => {
    const completedIds = new Set<string>((trainee.individualLMP?.completedEventIds || []).map((value: any) => String(value || '').trim()).filter(Boolean));
    const events = Array.isArray(trainee.individualLMP?.events) ? trainee.individualLMP.events : [];
    protectedCompletedEvents += events.filter((item: any) => isIndividualEventComplete(item, completedIds)).length;
  });
  return {
    assignedTrainees: trainees.length,
    protectedCompletedEvents,
  };
};

const refreshAssignedIndividualLmps = async (courseCode: string, masterSyllabus: any[], locationCode = '', unitCode = '') => {
  const trainees = await db.trainee.findMany({
    where: getAssignedTraineeWhere(courseCode, locationCode, unitCode),
    include: { individualLMP: true },
  });

  let created = 0;
  let updated = 0;
  let protectedCompletedEvents = 0;
  let ignoredUploadedHistoricalEvents = 0;
  let futureEventsFromUpdatedMaster = 0;
  const results: any[] = [];

  for (const trainee of trainees) {
    const existing = trainee.individualLMP;
    const existingEvents = Array.isArray(existing?.events) ? existing.events : [];
    const completedEventIds = Array.isArray(existing?.completedEventIds) ? existing.completedEventIds : [];
    const completedIds = new Set<string>(completedEventIds.map((value: any) => String(value || '').trim()).filter(Boolean));
    const protectedCount = existingEvents.filter((item: any) => isIndividualEventComplete(item, completedIds)).length;
    const mergeResult = mergeUpdatedMasterIntoIndividualLmp(existingEvents, masterSyllabus, completedEventIds);
    const mergedEvents = mergeResult.events;

    await db.individualLMP.upsert({
      where: { traineeId: trainee.id },
      update: {
        traineeFullName: trainee.fullName,
        lmpType: courseCode,
        events: mergedEvents,
        completedEventIds,
        updatedAt: new Date(),
      },
      create: {
        traineeId: trainee.id,
        traineeFullName: trainee.fullName,
        lmpType: courseCode,
        events: mergedEvents,
        completedEventIds,
      },
    });

    if (existing) updated += 1; else created += 1;
    protectedCompletedEvents += protectedCount;
    ignoredUploadedHistoricalEvents += Number(mergeResult.meta.ignoredUploadedHistoricalEvents || 0);
    futureEventsFromUpdatedMaster += Number(mergeResult.meta.futureEventsFromUpdatedMaster || 0);
    results.push({
      traineeFullName: trainee.fullName,
      beforeEvents: existingEvents.length,
      afterEvents: mergedEvents.length,
      protectedCompletedEvents: protectedCount,
      ...mergeResult.meta,
    });
  }

  return {
    assignedTrainees: trainees.length,
    created,
    updated,
    protectedCompletedEvents,
    ignoredUploadedHistoricalEvents,
    futureEventsFromUpdatedMaster,
    results: results.slice(0, 50),
  };
};

const getDuplicateSourceDetails = (item: any) => ({
  code: item?.code || '',
  sourceCourses: Array.isArray(item?.courses) ? item.courses.filter(Boolean) : [],
  sourceCourse: Array.isArray(item?.courses) ? item.courses.filter(Boolean)[0] || '' : '',
  sourceUnit: normaliseContextCode(item?.unit),
  sourceLocation: normaliseContextCode(item?.location),
  sourceLmpType: getNormalisedLmpType(item?.lmpType),
  sourceTitle: String(item?.module || item?.phase || '').trim(),
});

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }
    await requireCapability('training:manage');

    const formData = await request.formData();
    const file = formData.get('file');
    let selectedCourseCode = String(formData.get('courseCode') || '').trim();
    const packageName = String(formData.get('packageName') || '').trim();
    const uploadMode = String(formData.get('uploadMode') || 'update').trim();
    const uploadIntent = String(formData.get('uploadIntent') || '').trim();
    const dryRun = String(formData.get('dryRun') || '').trim() === 'true';
    const uploadedLmpVersion = String(formData.get('lmpVersion') || '').trim();
    const updateReviewMode = String(formData.get('updateReviewMode') || 'automatic').trim() === 'one-by-one' ? 'one-by-one' : 'automatic';
    const requestedLmpType = String(formData.get('lmpType') || 'Master LMP').trim();
    const lmpType = requestedLmpType === 'Staff CAT' ? 'Staff CAT' : 'Master LMP';
    const operationalModel = String(formData.get('operationalModel') || '').trim();
    const locationCode = String(formData.get('locationCode') || formData.get('location') || '').trim();
    const unitCode = String(formData.get('unitCode') || formData.get('unit') || '').trim();
    if (!selectedCourseCode && lmpType === 'Staff CAT' && uploadMode === 'create') {
      selectedCourseCode = getUnitScopedCollectionCode(getPackageCodeFromTitle(packageName), unitCode);
    }

    if (!selectedCourseCode) {
      return NextResponse.json(
        { error: 'No destination course/package selected' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No upload file supplied' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadValidationError = validateWorkbookUploadFile(file, buffer);
    if (uploadValidationError) {
      return NextResponse.json(
        { error: 'Upload rejected', message: uploadValidationError },
        { status: 415, headers: getCorsHeaders(request) }
      );
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
    const worksheetName = workbook.SheetNames.includes('Syllabus_LMP')
      ? 'Syllabus_LMP'
      : workbook.SheetNames[0];

    if (!worksheetName) {
      return NextResponse.json(
        { error: 'The upload file does not contain any worksheets' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const worksheet = workbook.Sheets[worksheetName];
    const skipStyledExampleRow = isStyledExampleSecondRow(worksheet, workbook);
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' })
      .filter((_, index) => !(skipStyledExampleRow && index === 0));
    const created: any[] = [];
    const updated: any[] = [];
    const errors: Array<{ row: number; error: string; duplicateSource?: any }> = [];
    let skipped = 0;
    let generatedCodeSequence = 1;
    let generatedPlaceholderUsed = false;
    const uploadedEventCodes: string[] = [];
    let uploadedEventRows = 0;

    if (uploadMode === 'replace') {
      const preflightErrors: Array<{ row: number; error: string; duplicateSource?: any }> = [];
      let preflightSequence = 1;
      let contentRows = 0;
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNumber = index + (skipStyledExampleRow ? 3 : 2);
        if (!rowHasUploadEventContent(row)) continue;
        contentRows += 1;

        const requiredDataErrors = getRequiredUploadDataErrors(row);
        if (requiredDataErrors.length > 0) {
          requiredDataErrors.forEach(error => preflightErrors.push({ row: rowNumber, error }));
          continue;
        }

        const courseFromRow = getString(row, ['Course', 'Package']);
        const courseCode = selectedCourseCode || courseFromRow;
        if (!courseCode) {
          preflightErrors.push({ row: rowNumber, error: 'Missing selected course/package code' });
          continue;
        }

        const explicitCode = getString(row, ['Event Code', 'Code', 'Event ID', 'Event Number']);
        const code = explicitCode || getGeneratedEventCode(courseCode, preflightSequence++);
        const existing = await db.syllabusItem.findUnique({ where: { code } });
        if (existing && !belongsToDestination(existing, courseCode, lmpType, operationalModel, locationCode, unitCode)) {
          preflightErrors.push({
            row: rowNumber,
            error: `Event code "${code}" already exists outside selected ${lmpType === 'Staff CAT' ? 'training package' : 'Master LMP'}`,
            duplicateSource: getDuplicateSourceDetails(existing),
          });
        }
      }

      if (contentRows === 0) {
        preflightErrors.push({ row: 1, error: 'The upload file does not contain any event rows' });
      }

      if (preflightErrors.length > 0) {
        return NextResponse.json(
          {
            created: 0,
            updated: 0,
            skipped: preflightErrors.length,
            errors: preflightErrors,
            message: 'Replace cancelled. Fix the upload errors and try again.',
          },
          { status: 400, headers: getCorsHeaders(request) }
        );
      }
    }

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!rowHasUploadEventContent(row)) continue;
      const requiredDataErrors = getRequiredUploadDataErrors(row);
      if (requiredDataErrors.length > 0) continue;
      uploadedEventRows += 1;
      const explicitCode = getString(row, ['Event Code', 'Code', 'Event ID', 'Event Number']);
      const code = explicitCode || getGeneratedEventCode(selectedCourseCode, uploadedEventRows);
      if (code) uploadedEventCodes.push(code);
    }

    const existingDestinationRows = await db.syllabusItem.findMany({
      where: {
        lmpType,
        courses: { has: selectedCourseCode },
        ...(lmpType === 'Staff CAT' && normaliseContextCode(operationalModel) === 'FIXED_CREW' && unitCode ? { unit: unitCode } : {}),
      },
      select: { id: true, code: true, isActive: true, notes: true },
    });
    const updateImpact = lmpType === 'Master LMP'
      ? await summariseIndividualUpdateImpact(selectedCourseCode, locationCode, unitCode)
      : { assignedTrainees: 0, protectedCompletedEvents: 0 };

    if (dryRun) {
      return NextResponse.json(
        {
          dryRun: true,
          created: 0,
          updated: 0,
          imported: 0,
          skipped: 0,
          errors: [],
          message: `Ready to ${uploadIntent === 'new' || uploadMode === 'create' ? 'create' : 'update'} ${lmpType === 'Staff CAT' ? 'Training Package' : 'Master LMP'} ${packageName || selectedCourseCode}.`,
          preview: {
            uploadIntent,
            uploadMode,
            updateReviewMode,
            destinationCode: selectedCourseCode,
            destinationName: packageName || selectedCourseCode,
            uploadedEventRows,
            uploadedEventCodes: uploadedEventCodes.slice(0, 30),
            existingMasterRows: existingDestinationRows.filter((item: any) => item.isActive !== false && !isCourseShellRow(item)).length,
            assignedTrainees: updateImpact.assignedTrainees,
            protectedCompletedEvents: updateImpact.protectedCompletedEvents,
            fileName: file.name,
            lmpVersion: uploadedLmpVersion || null,
          },
        },
        { headers: getCorsHeaders(request) }
      );
    }

    if (lmpType === 'Staff CAT' && uploadMode === 'create') {
      const existingPackageCount = await db.syllabusItem.count({
        where: {
          lmpType,
          isActive: true,
          courses: { has: selectedCourseCode },
          ...(normaliseContextCode(operationalModel) === 'FIXED_CREW' && unitCode ? { unit: unitCode } : {}),
        },
      });
      if (existingPackageCount > 0) {
        return NextResponse.json(
          { error: `Training package "${selectedCourseCode}" already exists. Select it and use update or replace.` },
          { status: 409, headers: getCorsHeaders(request) }
        );
      }
    }

    if (lmpType === 'Master LMP' && uploadMode === 'create') {
      const existingMasterCount = existingDestinationRows.filter((item: any) => item.isActive !== false).length;
      if (existingMasterCount > 0) {
        return NextResponse.json(
          { error: `Master LMP "${selectedCourseCode}" already exists. Select it and use Update existing LMP instead.` },
          { status: 409, headers: getCorsHeaders(request) }
        );
      }
    }

    if (lmpType === 'Staff CAT' && uploadMode === 'replace') {
      await db.syllabusItem.deleteMany({
        where: {
          lmpType,
          courses: { has: selectedCourseCode },
          ...(normaliseContextCode(operationalModel) === 'FIXED_CREW' && unitCode ? { unit: unitCode } : {}),
        },
      });
    }

    if (lmpType === 'Master LMP' && uploadMode === 'replace') {
      await db.syllabusItem.deleteMany({
        where: {
          lmpType,
          courses: { has: selectedCourseCode },
        },
      });
    }

    const maxOrder = await db.syllabusItem.aggregate({ _max: { sortOrder: true } });
    let nextSortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

    const reusablePackagePlaceholder = selectedCourseCode && lmpType === 'Staff CAT' && uploadMode !== 'replace'
      ? await db.syllabusItem.findFirst({
          where: {
            code: selectedCourseCode,
            lmpType,
            isActive: true,
            courses: { has: selectedCourseCode },
            ...(normaliseContextCode(operationalModel) === 'FIXED_CREW' && unitCode ? { unit: unitCode } : {}),
          },
        })
      : null;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + (skipStyledExampleRow ? 3 : 2);
      if (!rowHasUploadEventContent(row)) continue;

      const requiredDataErrors = getRequiredUploadDataErrors(row);
      if (requiredDataErrors.length > 0) {
        requiredDataErrors.forEach(error => errors.push({ row: rowNumber, error }));
        skipped += 1;
        continue;
      }

      const courseFromRow = getString(row, ['Course', 'Package']);
      const courseCode = selectedCourseCode || courseFromRow;
      if (!courseCode) {
        errors.push({ row: rowNumber, error: 'Missing selected course/package code' });
        skipped += 1;
        continue;
      }

      const explicitCode = getString(row, ['Event Code', 'Code', 'Event ID', 'Event Number']);
      const code = explicitCode || getGeneratedEventCode(courseCode, generatedCodeSequence++);

      const type = normaliseType(getString(row, ['Type']));
      const sortieType = type === 'Flight' ? normaliseSortieType(getString(row, ['Dual/Solo', 'sortieType'])) : null;
      const flightOrSimHours = getNumber(row, ['Flight or Sim Hours', 'flightOrSimHours']);
      const totalEventHours = getNumber(row, ['Total Event Hours', 'Total Event Hrs', 'totalEventHours']) ?? 0;
      const testEventType = normaliseLmpTestEventType(getString(row, ['Test Event Type', 'Test Event', 'Test Type']));
      const testingOfficerQualificationId = testEventType === 'NONE'
        ? null
        : normaliseTestingOfficerQualification(getString(row, ['Testing Officer Qualification', 'Testing Officer Qual', 'Test Officer Qualification', 'Test Officer Qual']));
      const useTestingOfficerSecondaryCallsign = testEventType === 'FLIGHT_TEST'
        && parseBooleanUploadValue(getString(row, ['Secondary Callsign', 'Use Secondary Callsign', 'Use Testing Officer Secondary Callsign']));
      const itemData = {
        code,
        eventDescription: getString(row, ['Event description', 'Event Description', 'Event Title', 'Title', 'Description', 'eventDescription']),
        phase: getString(row, ['Phase']) || courseCode,
        module: getString(row, ['Module']) || packageName || courseCode,
        type,
        sortieType,
        dayNight: normaliseDayNight(getString(row, ['Day/Night', 'dayNight'])),
        courses: [courseCode],
        methodOfDelivery: getList(row, ['Method/s of Delivery', 'methodOfDelivery']),
        methodOfAssessment: getList(row, ['Method/s of Assessment', 'Type/s and Method/s of Assessment', 'methodOfAssessment']),
        resourcesPhysical: getList(row, ['Resources Required (physical)', 'resourcesPhysical']),
        resourcesHuman: getList(row, ['Resources Required (Human)', 'resourcesHuman']),
        eventDetailsCommon: getList(row, ['Event Details - Common', 'eventDetailsCommon']),
        eventDetailsSortie: getList(row, ['Event Details - Sortie', 'Event Details (Sortie)', 'Event Details Sortie', 'eventDetailsSortie']),
        flightOrSimHours: flightOrSimHours ?? 0,
        totalEventHours,
        duration: flightOrSimHours ?? totalEventHours,
        preFlightTime: getNumber(row, ['Preflight Time', 'Pre Flight Time', 'Pre-Flight', 'Pre-flight', 'Pre Flight Minutes', 'preFlightTime']) ?? 0,
        postFlightTime: getNumber(row, ['Post Flight Time', 'Post-flight Time', 'Post-Flight', 'Post-flight', 'Post Flight Minutes', 'postFlightTime']) ?? 0,
        prerequisites: getList(row, ['prerequisites', 'Prerequisites']),
        prerequisitesGround: getList(row, ['Pre-requisite Events (Ground School)', 'prerequisitesGround']),
        prerequisitesFlying: getList(row, ['Pre-requisite Events (Sim/Flying)', 'prerequisitesFlying']),
        resourceNumber: getNumber(row, ['Resource Number', 'resourceNumber', 'Resources Required Number']) ?? 0,
        acceptableAircraftConfigs: normaliseAircraftConfigs(getString(row, ['CONFIG', 'Config', 'Acceptable CONFIG', 'Acceptable Aircraft CONFIG', 'acceptableAircraftConfigs'])),
        location: locationCode,
        unit: unitCode,
        lmpType,
        testEventType,
        testingOfficerQualificationId,
        useTestingOfficerSecondaryCallsign,
        notes: uploadedLmpVersion ? `[DFP_LMP_VERSION:${uploadedLmpVersion}]` : undefined,
        isActive: true,
      };

      const existing = await db.syllabusItem.findUnique({ where: { code } });
      if (existing) {
        if (!belongsToDestination(existing, courseCode, lmpType, operationalModel, locationCode, unitCode)) {
          errors.push({
            row: rowNumber,
            error: `Event code "${code}" already exists outside selected ${lmpType === 'Staff CAT' ? 'training package' : 'Master LMP'}`,
            duplicateSource: getDuplicateSourceDetails(existing),
          });
          skipped += 1;
          continue;
        }

        const updatedItem = await db.syllabusItem.update({
          where: { id: existing.id },
          data: { ...itemData, notes: uploadedLmpVersion ? itemData.notes : (isCourseShellRow(existing) ? null : existing.notes), version: { increment: 1 }, updatedAt: new Date() },
        });

        await db.syllabusHistory.create({
          data: {
            syllabusItemId: updatedItem.id,
            changeType: 'UPDATE',
            changeData: updatedItem as any,
            previousData: existing as any,
            changedBy: 'bulk-upload',
            changeReason: `Bulk upload update to ${lmpType === 'Staff CAT' ? 'Training Package' : 'Master LMP'}: ${courseCode}`,
          },
        });

        updated.push(updatedItem);
        continue;
      }

      if (!explicitCode && reusablePackagePlaceholder && !generatedPlaceholderUsed) {
        const updatedItem = await db.syllabusItem.update({
          where: { id: reusablePackagePlaceholder.id },
          data: { ...itemData, notes: uploadedLmpVersion ? itemData.notes : (isCourseShellRow(reusablePackagePlaceholder) ? null : reusablePackagePlaceholder.notes), version: { increment: 1 }, updatedAt: new Date() },
        });

        await db.syllabusHistory.create({
          data: {
            syllabusItemId: updatedItem.id,
            changeType: 'UPDATE',
            changeData: updatedItem as any,
            previousData: reusablePackagePlaceholder as any,
            changedBy: 'bulk-upload',
            changeReason: `Bulk upload populated Training Package: ${courseCode}`,
          },
        });

        generatedPlaceholderUsed = true;
        updated.push(updatedItem);
        continue;
      }

      const newItem = await db.syllabusItem.create({
        data: {
          ...itemData,
          sortOrder: nextSortOrder++,
          version: 1,
          createdBy: 'bulk-upload',
        },
      });

      await db.syllabusHistory.create({
        data: {
          syllabusItemId: newItem.id,
          changeType: 'CREATE',
          changeData: newItem as any,
          changedBy: 'bulk-upload',
          changeReason: `Bulk upload to ${lmpType === 'Staff CAT' ? 'Training Package' : 'Master LMP'}: ${courseCode}`,
        },
      });

      created.push(newItem);
    }

    let individualLmpSync: any = null;
    if (lmpType === 'Master LMP' && (uploadMode === 'replace' || uploadIntent === 'update')) {
      const masterSyllabus = await db.syllabusItem.findMany({
        where: {
          lmpType: 'Master LMP',
          isActive: true,
          courses: { has: selectedCourseCode },
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      });
      individualLmpSync = await refreshAssignedIndividualLmps(selectedCourseCode, masterSyllabus, locationCode, unitCode);

      const historyAnchorId = masterSyllabus[0]?.id || created[0]?.id || updated[0]?.id;
      if (historyAnchorId) {
        await db.syllabusHistory.create({
          data: {
            syllabusItemId: historyAnchorId,
            changeType: 'UPDATE',
            changeData: {
              courseCode: selectedCourseCode,
          uploadIntent,
          uploadMode,
          updateReviewMode,
          uploadedEventRows,
              individualLmpSync,
            } as any,
            changedBy: 'bulk-upload',
            changeReason: `Bulk upload refreshed assigned Individual LMPs for Master LMP: ${selectedCourseCode}`,
          },
        });
      }
    }

    return NextResponse.json(
      {
        created: created.length,
        updated: updated.length,
        imported: created.length + updated.length,
        skipped,
        errors,
        preview: {
          uploadIntent,
          uploadMode,
          updateReviewMode,
          destinationCode: selectedCourseCode,
          destinationName: packageName || selectedCourseCode,
          uploadedEventRows,
          existingMasterRows: existingDestinationRows.filter((item: any) => item.isActive !== false && !isCourseShellRow(item)).length,
          assignedTrainees: updateImpact.assignedTrainees,
          protectedCompletedEvents: updateImpact.protectedCompletedEvents,
          lmpVersion: uploadedLmpVersion || null,
        },
        individualLmpSync,
        message: `${created.length + updated.length} row${created.length + updated.length === 1 ? '' : 's'} imported into ${lmpType === 'Staff CAT' ? 'Training Package' : 'Master LMP'} ${packageName || selectedCourseCode || ''}`.trim(),
      },
      { headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    console.error('Error bulk uploading syllabus:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to upload syllabus packages' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to bulk upload syllabus events' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
