import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const db = prisma as any;

const REQUIRED_COLUMNS = [
  'Type',
  'Event description',
  'Event Details - Sortie',
  'Total Event Hours',
  'Method/s of Delivery',
  'Resources Required (Human)',
];

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
  if (cleanValue === 'flight') return 'Flight';
  if (cleanValue === 'ftd') return 'FTD';
  if (cleanValue === 'academics' || cleanValue === 'academic') return 'Academics';
  if (cleanValue === 'ground' || cleanValue === 'ground school' || cleanValue === 'cpt') return 'Ground School';
  return value || 'Ground School';
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

const getNormalisedLmpType = (value: string | null | undefined): 'Staff CAT' | 'Master LMP' =>
  value === 'Staff CAT' ? 'Staff CAT' : 'Master LMP';

const getGeneratedCodePrefix = (courseCode: string): string => {
  const cleanPrefix = courseCode.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  return cleanPrefix || 'PKG';
};

const getGeneratedEventCode = (courseCode: string, sequence: number): string =>
  `${getGeneratedCodePrefix(courseCode)}${String(sequence).padStart(2, '0')}`;

const rowHasContent = (row: Record<string, any>): boolean =>
  Object.values(row).some(value => value !== undefined && value !== null && String(value).trim() !== '');

const belongsToDestination = (item: any, courseCode: string, lmpType: 'Staff CAT' | 'Master LMP'): boolean => {
  const courses = Array.isArray(item?.courses) ? item.courses : [];
  return getNormalisedLmpType(item?.lmpType) === lmpType && courses.includes(courseCode);
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const selectedCourseCode = String(formData.get('courseCode') || '').trim();
    const requestedLmpType = String(formData.get('lmpType') || 'Master LMP').trim();
    const lmpType = requestedLmpType === 'Staff CAT' ? 'Staff CAT' : 'Master LMP';

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
    const maxOrder = await db.syllabusItem.aggregate({ _max: { sortOrder: true } });
    let nextSortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

    const reusablePackagePlaceholder = selectedCourseCode && lmpType === 'Staff CAT'
      ? await db.syllabusItem.findFirst({
          where: {
            code: selectedCourseCode,
            lmpType,
            isActive: true,
            courses: { has: selectedCourseCode },
          },
        })
      : null;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2;
      if (!rowHasContent(row)) continue;

      const missingColumns = REQUIRED_COLUMNS.filter(column => !getString(row, [column]));
      if (missingColumns.length > 0) {
        errors.push({ row: rowNumber, error: `Missing required fields: ${missingColumns.join(', ')}` });
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
        module: getString(row, ['Module']) || courseCode,
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
        location: '',
        lmpType,
        isActive: true,
      };

      const existing = await db.syllabusItem.findUnique({ where: { code } });
      if (existing) {
        if (!belongsToDestination(existing, courseCode, lmpType)) {
          errors.push({
            row: rowNumber,
            error: `Event code "${code}" already exists outside selected ${lmpType === 'Staff CAT' ? 'training package' : 'Master LMP'}`,
          });
          skipped += 1;
          continue;
        }

        const updatedItem = await db.syllabusItem.update({
          where: { id: existing.id },
          data: { ...itemData, version: { increment: 1 }, updatedAt: new Date() },
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
          data: { ...itemData, version: { increment: 1 }, updatedAt: new Date() },
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
        skipped,
        errors,
        message: `${created.length} created, ${updated.length} updated in ${lmpType === 'Staff CAT' ? 'Training Package' : 'Master LMP'} ${selectedCourseCode || ''}`.trim(),
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
