import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const db = prisma as any;

const REQUIRED_COLUMNS = [
  'Event description',
  'Type',
];

const SYLLABUS_COURSE_SHELL_NOTE = '[DFP_COURSE_SHELL]';

const UPLOAD_TYPE_LABELS = new Set([
  'flight',
  'flying',
  'ftd',
  'sim',
  'simulator',
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
  if (cleanValue === 'ftd' || cleanValue === 'sim' || cleanValue === 'simulator') return 'FTD';
  if (cleanValue === 'academics' || cleanValue === 'academic') return 'Academics';
  if (cleanValue === 'ground' || cleanValue === 'ground school' || cleanValue === 'cpt' || cleanValue === 'tut' || cleanValue === 'tutorial' || cleanValue === 'brief' || cleanValue === 'mass brief') return 'Ground School';
  return value || 'Ground School';
};

const getRequiredUploadDataErrors = (row: Record<string, any>): string[] => {
  const errors: string[] = [];
  const missingColumns = REQUIRED_COLUMNS.filter(column => !getString(row, [column]));
  if (missingColumns.length > 0) errors.push(`Missing required fields: ${missingColumns.join(', ')}`);

  const typeValue = getString(row, ['Type']);
  if (typeValue && !UPLOAD_TYPE_LABELS.has(typeValue.trim().toLowerCase())) {
    errors.push(`Type must be one of: Flight, FTD, Academics, Ground School, CPT`);
  }

  const flightOrSimHours = getNumber(row, ['Flight or Sim Hours', 'flightOrSimHours']);
  const totalEventHours = getNumber(row, ['Total Event Hours', 'totalEventHours']);
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

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    let selectedCourseCode = String(formData.get('courseCode') || '').trim();
    const packageName = String(formData.get('packageName') || '').trim();
    const uploadMode = String(formData.get('uploadMode') || 'update').trim();
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
    const workbook = XLSX.read(buffer, { type: 'buffer' });
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
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    const created: any[] = [];
    const updated: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];
    let skipped = 0;
    let generatedCodeSequence = 1;
    let generatedPlaceholderUsed = false;

    if (uploadMode === 'replace') {
      const preflightErrors: Array<{ row: number; error: string }> = [];
      let preflightSequence = 1;
      let contentRows = 0;
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNumber = index + 2;
        if (!rowHasContent(row)) continue;
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

        const explicitCode = getString(row, ['Code']);
        const code = explicitCode || getGeneratedEventCode(courseCode, preflightSequence++);
        const existing = await db.syllabusItem.findUnique({ where: { code } });
        if (existing && !belongsToDestination(existing, courseCode, lmpType, operationalModel, locationCode, unitCode)) {
          preflightErrors.push({
            row: rowNumber,
            error: `Event code "${code}" already exists outside selected ${lmpType === 'Staff CAT' ? 'training package' : 'Master LMP'}`,
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

    if (lmpType === 'Staff CAT' && uploadMode === 'replace') {
      await db.syllabusItem.deleteMany({
        where: {
          lmpType,
          courses: { has: selectedCourseCode },
          ...(normaliseContextCode(operationalModel) === 'FIXED_CREW' && unitCode ? { unit: unitCode } : {}),
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
      const rowNumber = index + 2;
      if (!rowHasContent(row)) continue;

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

      const explicitCode = getString(row, ['Code']);
      const code = explicitCode || getGeneratedEventCode(courseCode, generatedCodeSequence++);

      const type = normaliseType(getString(row, ['Type']));
      const sortieType = type === 'Flight' ? normaliseSortieType(getString(row, ['Dual/Solo', 'sortieType'])) : null;
      const flightOrSimHours = getNumber(row, ['Flight or Sim Hours', 'flightOrSimHours']);
      const totalEventHours = getNumber(row, ['Total Event Hours', 'totalEventHours']) ?? 0;
      const itemData = {
        code,
        eventDescription: getString(row, ['Event description', 'eventDescription']),
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
        eventDetailsSortie: getList(row, ['Event Details - Sortie', 'eventDetailsSortie']),
        flightOrSimHours: flightOrSimHours ?? 0,
        totalEventHours,
        duration: flightOrSimHours ?? totalEventHours,
        preFlightTime: getNumber(row, ['Pre-flight', 'preFlightTime']) ?? 0,
        postFlightTime: getNumber(row, ['Post-flight', 'postFlightTime']) ?? 0,
        prerequisites: getList(row, ['prerequisites', 'Prerequisites']),
        prerequisitesGround: getList(row, ['Pre-requisite Events (Ground School)', 'prerequisitesGround']),
        prerequisitesFlying: getList(row, ['Pre-requisite Events (Sim/Flying)', 'prerequisitesFlying']),
        resourceNumber: getNumber(row, ['Resource Number', 'resourceNumber', 'Resources Required Number']) ?? 0,
        acceptableAircraftConfigs: normaliseAircraftConfigs(getString(row, ['CONFIG', 'Config', 'Acceptable CONFIG', 'Acceptable Aircraft CONFIG', 'acceptableAircraftConfigs'])),
        location: locationCode,
        unit: unitCode,
        lmpType,
        isActive: true,
      };

      const existing = await db.syllabusItem.findUnique({ where: { code } });
      if (existing) {
        if (!belongsToDestination(existing, courseCode, lmpType, operationalModel, locationCode, unitCode)) {
          errors.push({
            row: rowNumber,
            error: `Event code "${code}" already exists outside selected ${lmpType === 'Staff CAT' ? 'training package' : 'Master LMP'}`,
          });
          skipped += 1;
          continue;
        }

        const updatedItem = await db.syllabusItem.update({
          where: { id: existing.id },
          data: { ...itemData, notes: isCourseShellRow(existing) ? null : existing.notes, version: { increment: 1 }, updatedAt: new Date() },
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
          data: { ...itemData, notes: isCourseShellRow(reusablePackagePlaceholder) ? null : reusablePackagePlaceholder.notes, version: { increment: 1 }, updatedAt: new Date() },
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

    return NextResponse.json(
      {
        created: created.length,
        updated: updated.length,
        imported: created.length + updated.length,
        skipped,
        errors,
        message: `${created.length + updated.length} row${created.length + updated.length === 1 ? '' : 's'} imported into ${lmpType === 'Staff CAT' ? 'Training Package' : 'Master LMP'} ${packageName || selectedCourseCode || ''}`.trim(),
      },
      { headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    console.error('Error bulk uploading syllabus:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to bulk upload syllabus events' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
