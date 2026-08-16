import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


const getMasterEventId = (item: any): string => item?.masterEventId || item?.id || item?.code || '';
const createLmpOrderKey = (index: number): string => String(index + 1).padStart(5, '0');
const isLmpOverlayItem = (item: any): boolean =>
  item?.lmpSource === 'remedial' ||
  item?.lmpSource === 'custom' ||
  item?.isRemedial === true ||
  item?.id?.includes?.('REM') ||
  item?.id?.endsWith?.('-RF') ||
  item?.code?.includes?.('REM') ||
  item?.code?.endsWith?.('-RF') ||
  item?.id?.endsWith?.('-CUR') ||
  item?.code?.endsWith?.('-CUR');

const stampMasterLmpItems = (masterSyllabus: any[]): any[] =>
  masterSyllabus.map((item, index) => ({
    ...item,
    masterEventId: getMasterEventId(item),
    lmpSource: 'master',
    orderKey: item.orderKey || createLmpOrderKey(index),
    placementNeedsReview: false,
  }));

const INDIVIDUAL_LMP_EDITABLE_FIELDS = [
  'code',
  'eventDescription',
  'phase',
  'module',
  'dayNight',
  'type',
  'sortieType',
  'methodOfDelivery',
  'methodOfAssessment',
  'resourcesPhysical',
  'resourcesHuman',
  'resourceNumber',
  'resourceCount',
  'acceptableAircraftConfigs',
  'eventDetailsCommon',
  'eventDetailsSortie',
  'flightOrSimHours',
  'totalEventHours',
  'duration',
  'preFlightTime',
  'postFlightTime',
  'individualTimingOverrides',
  'prerequisites',
  'prerequisitesGround',
  'prerequisitesFlying',
  'location',
  'twrDiReqd',
  'cctOnly',
  'notes',
  'trainingReportNextEventExtensions',
  'trainingReportLastExtendedByAssessmentId',
];

const getIndividualLmpMasterOverrides = (item?: any, masterItem?: any): Record<string, any> => {
  if (!item) return {};
  return INDIVIDUAL_LMP_EDITABLE_FIELDS.reduce((overrides, field) => {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      if (field === 'preFlightTime' || field === 'postFlightTime') {
        const hasExplicitTimingOverride = item?.individualTimingOverrides?.[field] === true;
        const individualValue = typeof item[field] === 'number' && Number.isFinite(item[field]) ? item[field] : null;
        const masterValue = typeof masterItem?.[field] === 'number' && Number.isFinite(masterItem[field]) ? masterItem[field] : null;
        const legacyLooksLikeMissingTiming =
          !hasExplicitTimingOverride &&
          masterValue !== null &&
          masterValue > 0 &&
          (individualValue === null || individualValue === 0);
        if (legacyLooksLikeMissingTiming) {
          return overrides;
        }
      }
      overrides[field] = item[field];
    }
    return overrides;
  }, {} as Record<string, any>);
};

const summariseReportLmpItems = (events: any) => {
  const items = Array.isArray(events) ? events : [];
  const reportItems = items.filter(item =>
    item?.trainingReportSourceAssessmentId ||
    item?.trainingReportSourceEventId ||
    item?.trainingReportNextEventExtensions ||
    item?.trainingReportLastExtendedByAssessmentId ||
    item?.isRemedial === true ||
    item?.lmpSource === 'remedial'
  );
  return {
    eventCount: items.length,
    reportItemCount: reportItems.length,
    reportItems: reportItems.slice(0, 12).map(item => ({
      id: item?.id,
      code: item?.code,
      type: item?.type,
      lmpSource: item?.lmpSource,
      isRemedial: item?.isRemedial,
      masterEventId: item?.masterEventId,
      anchorAfterMasterEventId: item?.anchorAfterMasterEventId,
      anchorBeforeMasterEventId: item?.anchorBeforeMasterEventId,
      flightOrSimHours: item?.flightOrSimHours,
      duration: item?.duration,
      totalEventHours: item?.totalEventHours,
      trainingReportSourceAssessmentId: item?.trainingReportSourceAssessmentId,
      trainingReportSourceEventId: item?.trainingReportSourceEventId,
      trainingReportNextEventExtensions: item?.trainingReportNextEventExtensions,
      trainingReportLastExtendedByAssessmentId: item?.trainingReportLastExtendedByAssessmentId,
    })),
  };
};

const mergeIndividualLmpWithMaster = (
  existingEvents: any[] | undefined,
  masterSyllabus: any[],
  completedFromScores: Set<string>,
  scores: { event: string; date: Date }[]
): any[] => {
  const stampedMaster = stampMasterLmpItems(masterSyllabus);
  if (!existingEvents || existingEvents.length === 0) {
    return stampedMaster.map(item => ({
      ...item,
      completedAt: completedFromScores.has(item.id || item.code)
        ? scores.find(s => s.event === (item.id || item.code))?.date?.toISOString() || null
        : null,
    }));
  }

  const masterIds = new Set(stampedMaster.map(getMasterEventId).filter(Boolean));
  const existingByMasterId = new Map<string, any>();
  existingEvents.forEach(item => {
    if (isLmpOverlayItem(item)) return;
    const masterId = getMasterEventId(item);
    if (masterId) existingByMasterId.set(masterId, item);
  });

  const mergedMaster = stampedMaster.map((masterItem, index) => {
    const existingItem = existingByMasterId.get(getMasterEventId(masterItem));
    const completedAt = completedFromScores.has(masterItem.id || masterItem.code)
      ? scores.find(s => s.event === (masterItem.id || masterItem.code))?.date?.toISOString() || existingItem?.completedAt || null
      : existingItem?.completedAt ?? null;

    return {
      ...masterItem,
      ...getIndividualLmpMasterOverrides(existingItem, masterItem),
      id: masterItem.id,
      masterEventId: getMasterEventId(masterItem),
      lmpSource: 'master',
      completedAt,
      userLockedPosition: existingItem?.userLockedPosition,
      orderKey: existingItem?.orderKey || masterItem.orderKey || createLmpOrderKey(index),
      placementNeedsReview: false,
    };
  });

  const masterIndexById = new Map<string, number>();
  mergedMaster.forEach((item, index) => {
    const masterId = getMasterEventId(item);
    if (masterId) masterIndexById.set(masterId, index);
  });

  const overlays = existingEvents.filter(isLmpOverlayItem).map((item, index) => {
    const itemIndex = existingEvents.indexOf(item);
    const fallbackAfter = item.anchorAfterMasterEventId || getMasterEventId(existingEvents.slice(0, itemIndex).reverse().find(prev => !isLmpOverlayItem(prev)) || {});
    const fallbackBefore = item.anchorBeforeMasterEventId || getMasterEventId(existingEvents.slice(itemIndex + 1).find(next => !isLmpOverlayItem(next)) || {});
    const afterExists = !!fallbackAfter && masterIds.has(fallbackAfter);
    const beforeExists = !!fallbackBefore && masterIds.has(fallbackBefore);

    return {
      ...item,
      lmpSource: item.lmpSource || (item.isRemedial ? 'remedial' : 'custom'),
      orderKey: item.orderKey || `${createLmpOrderKey(index)}.500`,
      anchorAfterMasterEventId: fallbackAfter || undefined,
      anchorBeforeMasterEventId: fallbackBefore || undefined,
      anchorPolicy: item.anchorPolicy || 'between',
      placementNeedsReview: !(afterExists || beforeExists),
    };
  });

  const overlaysBefore = new Map<string, any[]>();
  const overlaysAfter = new Map<string, any[]>();
  const appendOverlays: any[] = [];

  overlays.forEach(overlay => {
    const policy = overlay.anchorPolicy || 'between';
    const beforeId = overlay.anchorBeforeMasterEventId;
    const afterId = overlay.anchorAfterMasterEventId;

    if ((policy === 'between' || policy === 'before') && beforeId && masterIndexById.has(beforeId)) {
      const list = overlaysBefore.get(beforeId) || [];
      list.push(overlay);
      overlaysBefore.set(beforeId, list);
      return;
    }

    if (afterId && masterIndexById.has(afterId)) {
      const list = overlaysAfter.get(afterId) || [];
      list.push(overlay);
      overlaysAfter.set(afterId, list);
      return;
    }

    appendOverlays.push({ ...overlay, placementNeedsReview: true });
  });

  const result: any[] = [];
  mergedMaster.forEach(masterItem => {
    const masterId = getMasterEventId(masterItem);
    result.push(...(masterId ? overlaysBefore.get(masterId) || [] : []).sort((a, b) => (a.orderKey || '').localeCompare(b.orderKey || '')));
    result.push(masterItem);
    result.push(...(masterId ? overlaysAfter.get(masterId) || [] : []).sort((a, b) => (a.orderKey || '').localeCompare(b.orderKey || '')));
  });

  return [...result, ...appendOverlays.sort((a, b) => (a.orderKey || '').localeCompare(b.orderKey || ''))];
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// GET /api/trainees/lmp-sync
// Returns all IndividualLMPs (just traineeFullName + completedEventIds for fast load)
export async function GET(request: NextRequest) {
  try {
    const includeEvents = request.nextUrl.searchParams.get('includeEvents') === 'true';
    const select: Record<string, boolean> = {
      traineeId: true,
      traineeFullName: true,
      lmpType: true,
      completedEventIds: true,
      updatedAt: true,
    };
    if (includeEvents) {
      select.events = true;
    }

    const lmps = await (prisma as any).individualLMP.findMany({
      select,
      orderBy: { traineeFullName: 'asc' },
    });

    return NextResponse.json({ lmps, count: lmps.length }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('[LMP Sync GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LMP completions' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

// POST /api/trainees/lmp-sync
// Syncs PT-051 Score records → IndividualLMP completedEventIds for ALL trainees.
// For each trainee: reads their Score.event values, marks those events complete in LMP.
// Body: { syllabusData: Record<string, SyllabusItemDetail[]> }
//   syllabusData is keyed by the configured LMP/catalogue name and contains the master syllabus items.
//   The frontend sends this because the backend has no knowledge of the syllabus structure.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { syllabusData } = body as {
      syllabusData: Record<string, any[]>; // lmpType → SyllabusItemDetail[]
    };

    if (!syllabusData || Object.keys(syllabusData).length === 0) {
      return NextResponse.json(
        { error: 'Missing syllabusData in request body' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Fetch all active trainees with their scores and existing LMP
    const trainees = await prisma.trainee.findMany({
      where: { isActive: true },
      include: {
        scores: {
          select: { event: true, date: true, score: true },
          orderBy: { date: 'asc' },
        },
        individualLMP: true,
      },
    });

    console.log(`[LMP Sync] Processing ${trainees.length} trainees...`);

    const results: {
      traineeFullName: string;
      lmpType: string;
      totalEvents: number;
      completedCount: number;
      newlyMarked: string[];
      status: 'created' | 'updated' | 'unchanged' | 'no_syllabus';
    }[] = [];

    for (const trainee of trainees) {
      const syllabusKeys = Object.keys(syllabusData).filter(key => Array.isArray(syllabusData[key]) && syllabusData[key].length > 0);
      const existing = (trainee as any).individualLMP;
      const configuredLmpType = String((trainee as any).lmpType || existing?.lmpType || '').trim();
      const courseKey = String((trainee as any).course || '').trim();
      const lmpType = configuredLmpType
        || (courseKey && syllabusData[courseKey] ? courseKey : '')
        || (syllabusKeys.length === 1 ? syllabusKeys[0] : '');

      // Get the master syllabus for this LMP type
      const masterSyllabus = lmpType ? syllabusData[lmpType] : [];
      if (!masterSyllabus || masterSyllabus.length === 0) {
        results.push({
          traineeFullName: trainee.fullName,
          lmpType: lmpType || 'Unassigned',
          totalEvents: 0,
          completedCount: 0,
          newlyMarked: [],
          status: 'no_syllabus',
        });
        continue;
      }

      // Build set of completed event IDs from PT-051 Score records
      const completedFromScores = new Set<string>(
        trainee.scores.map((s: any) => s.event as string)
      );

      const completedEventIds = Array.from(completedFromScores);

      // Check if LMP already exists and what it contains
      const existingEvents = Array.isArray(existing?.events) ? existing.events as any[] : [];
      const existingCompleted = existing
        ? (existing.completedEventIds as string[])
        : [];

      const newlyMarked = completedEventIds.filter(
        (id) => !existingCompleted.includes(id)
      );

      const lmpEvents = mergeIndividualLmpWithMaster(existingEvents, masterSyllabus, completedFromScores, trainee.scores as any[]);
      const beforeSummary = summariseReportLmpItems(existingEvents);
      const afterSummary = summariseReportLmpItems(lmpEvents);
      if (beforeSummary.reportItemCount > 0 || afterSummary.reportItemCount > 0) {
        console.log('[LMP Sync DIAG] merge report items', {
          traineeFullName: trainee.fullName,
          lmpType,
          masterSyllabusEvents: masterSyllabus.length,
          completedEventIds: completedEventIds.length,
          before: beforeSummary,
          after: afterSummary,
        });
      }

      // Upsert the IndividualLMP
      await (prisma as any).individualLMP.upsert({
        where: { traineeId: trainee.id },
        update: {
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
          updatedAt: new Date(),
        },
        create: {
          traineeId: trainee.id,
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
        },
      });

      results.push({
        traineeFullName: trainee.fullName,
        lmpType,
        totalEvents: masterSyllabus.length,
        completedCount: completedEventIds.length,
        newlyMarked,
        status: !existing ? 'created' : newlyMarked.length > 0 ? 'updated' : 'unchanged',
      });

      console.log(
        `[LMP Sync] ${trainee.fullName} (${lmpType}): ${completedEventIds.length}/${masterSyllabus.length} events complete` +
          (newlyMarked.length > 0 ? ` — newly marked: ${newlyMarked.join(', ')}` : '')
      );
    }

    const created = results.filter((r) => r.status === 'created').length;
    const updated = results.filter((r) => r.status === 'updated').length;
    const unchanged = results.filter((r) => r.status === 'unchanged').length;
    const noSyllabus = results.filter((r) => r.status === 'no_syllabus').length;

    console.log(
      `[LMP Sync] ✅ Done — ${created} created, ${updated} updated, ${unchanged} unchanged, ${noSyllabus} skipped (no syllabus)`
    );

    return NextResponse.json(
      {
        success: true,
        summary: { created, updated, unchanged, noSyllabus, total: trainees.length },
        results,
      },
      { headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('[LMP Sync POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync LMPs', details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
