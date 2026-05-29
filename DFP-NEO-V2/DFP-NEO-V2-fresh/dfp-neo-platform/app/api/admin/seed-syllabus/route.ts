import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple security: require a secret key in the request header or query param.
// SEED_SECRET must be explicitly configured outside local development.
function getSeedSecret() {
  const secret = process.env.SEED_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') return '';
  return 'dfp-seed-development-only';
}

// ============================================================================
// SYLLABUS ITEMS - Using correct codes that match PT-051 score records
// BGF1, BGF MB1, BGF FTD1, BIF1, BNF1, FIC1, etc.
// These MUST match the 'event' field in Score records
// ============================================================================

interface SyllabusItemSeed {
  code: string;
  eventDescription: string;
  phase: string;
  module: string;
  type: string;
  sortieType?: string | null;
  dayNight: string;
  courses: string[];
  methodOfDelivery: string[];
  methodOfAssessment: string[];
  resourcesPhysical: string[];
  resourcesHuman: string[];
  eventDetailsCommon: string[];
  eventDetailsSortie: string[];
  flightOrSimHours: number;
  totalEventHours: number;
  duration: number;
  preFlightTime: number;
  postFlightTime: number;
  prerequisites: string[];
  prerequisitesGround: string[];
  prerequisitesFlying: string[];
  location: string;
  sortOrder: number;
  lmpType?: string | null;
  twrDiReqd?: string | null;
  cctOnly?: string | null;
  isRemedial: boolean;
  isActive: boolean;
  version: number;
  notes: string | null;
  createdBy: string;
}

function makeFlight(code: string, desc: string, courses: string[], sortOrder: number, overrides: Partial<SyllabusItemSeed> = {}): SyllabusItemSeed {
  const isSolo = ['BGF11', 'BGF18'].includes(code);
  let phase = 'BGF';
  if (code.startsWith('BIF')) phase = 'BIF';
  else if (code.startsWith('BNF')) phase = 'BNF';
  else if (code.startsWith('BNAV')) phase = 'BNAV';
  else if (code.startsWith('FIC') || code.startsWith('AIT')) phase = 'FIC';
  else if (code.startsWith('WSO')) phase = 'WSO';
  else if (code.startsWith('OFI')) phase = 'OFI';

  const phaseNames: Record<string,string> = {
    BGF: 'Basic General Flying', BIF: 'Basic Instrument Flying',
    BNF: 'Basic Night Flying', BNAV: 'Basic Navigation',
    FIC: 'Flight Instructor Course', WSO: 'Weapons Systems Officer', OFI: 'Operational Flying Instructor',
  };

  return {
    code,
    eventDescription: desc,
    phase,
    module: phaseNames[phase] || phase,
    type: 'Flight',
    sortieType: isSolo ? 'Solo' : 'Dual',
    dayNight: 'Day',
    courses,
    methodOfDelivery: ['Dual Sortie', 'Brief', 'Debrief'],
    methodOfAssessment: ['Instructor Assessment', 'Debrief'],
    resourcesPhysical: ['PC-21'],
    resourcesHuman: ['QFI', 'Trainee'],
    eventDetailsCommon: [],
    eventDetailsSortie: [],
    flightOrSimHours: 1.0,
    totalEventHours: 2.0,
    duration: 2.0,
    preFlightTime: 0.5,
    postFlightTime: 0.5,
    prerequisites: [],
    prerequisitesGround: [],
    prerequisitesFlying: [],
    location: '',
    sortOrder,
    lmpType: null,
    twrDiReqd: isSolo ? 'YES' : 'NO',
    cctOnly: code === 'BGF10' ? 'YES' : 'NO',
    isRemedial: false,
    isActive: true,
    version: 1,
    notes: null,
    createdBy: 'seed-api',
    ...overrides,
  };
}

function makeFTD(code: string, desc: string, courses: string[], sortOrder: number, overrides: Partial<SyllabusItemSeed> = {}): SyllabusItemSeed {
  let phase = 'BGF';
  if (code.startsWith('BIF')) phase = 'BIF';
  else if (code.startsWith('BNF')) phase = 'BNF';
  else if (code.startsWith('BNAV')) phase = 'BNAV';
  else if (code.startsWith('FIC') || code.startsWith('AIT')) phase = 'FIC';

  const phaseNames: Record<string,string> = {
    BGF: 'Basic General Flying', BIF: 'Basic Instrument Flying',
    BNF: 'Basic Night Flying', BNAV: 'Basic Navigation', FIC: 'Flight Instructor Course',
  };

  return {
    code,
    eventDescription: desc,
    phase,
    module: phaseNames[phase] || phase,
    type: 'FTD',
    sortieType: 'Dual',
    dayNight: 'Day',
    courses,
    methodOfDelivery: ['FTD', 'Brief', 'Debrief'],
    methodOfAssessment: ['Instructor Assessment', 'Debrief'],
    resourcesPhysical: ['FTD'],
    resourcesHuman: ['QFI', 'Trainee'],
    eventDetailsCommon: [],
    eventDetailsSortie: [],
    flightOrSimHours: 2.0,
    totalEventHours: 2.5,
    duration: 2.5,
    preFlightTime: 40/60,
    postFlightTime: 30/60,
    prerequisites: [],
    prerequisitesGround: [],
    prerequisitesFlying: [],
    location: 'FTD Complex',
    sortOrder,
    lmpType: null,
    twrDiReqd: null,
    cctOnly: null,
    isRemedial: false,
    isActive: true,
    version: 1,
    notes: null,
    createdBy: 'seed-api',
    ...overrides,
  };
}

function makeGround(code: string, desc: string, courses: string[], sortOrder: number, overrides: Partial<SyllabusItemSeed> = {}): SyllabusItemSeed {
  let phase = 'BGF';
  if (code.startsWith('BIF')) phase = 'BIF';
  else if (code.startsWith('BNF')) phase = 'BNF';
  else if (code.startsWith('BNAV')) phase = 'BNAV';
  else if (code.startsWith('FIC') || code.startsWith('AIT')) phase = 'FIC';

  const phaseNames: Record<string,string> = {
    BGF: 'Basic General Flying', BIF: 'Basic Instrument Flying',
    BNF: 'Basic Night Flying', BNAV: 'Basic Navigation', FIC: 'Flight Instructor Course',
  };

  const isCPT = code.includes('CPT');

  return {
    code,
    eventDescription: desc,
    phase,
    module: phaseNames[phase] || phase,
    type: 'Ground School',
    sortieType: null,
    dayNight: 'Day',
    courses,
    methodOfDelivery: isCPT ? ['CPT', 'Brief'] : ['Classroom', 'Brief'],
    methodOfAssessment: ['Written Assessment', 'Observation'],
    resourcesPhysical: isCPT ? ['CPT'] : [],
    resourcesHuman: ['QFI', 'Trainee'],
    eventDetailsCommon: [],
    eventDetailsSortie: [],
    flightOrSimHours: isCPT ? 1.0 : 0,
    totalEventHours: isCPT ? 1.5 : 1.0,
    duration: isCPT ? 1.5 : 1.0,
    preFlightTime: isCPT ? 15/60 : 0,
    postFlightTime: isCPT ? 15/60 : 0,
    prerequisites: [],
    prerequisitesGround: [],
    prerequisitesFlying: [],
    location: isCPT ? 'CPT Rooms' : 'Classroom',
    sortOrder,
    lmpType: null,
    twrDiReqd: null,
    cctOnly: null,
    isRemedial: false,
    isActive: true,
    version: 1,
    notes: null,
    createdBy: 'seed-api',
    ...overrides,
  };
}

const BPC_IPC = ['BPC+IPC'];
const FIC_ONLY = ['FIC'];

// Full syllabus - codes MUST match Score records (s.event field in PT-051)
const SYLLABUS_ITEMS: SyllabusItemSeed[] = [
  // ========== BGF Phase ==========
  makeGround('BGF MB1', 'Preparation and Pre / Post Flight Admin', BPC_IPC, 10),
  makeGround('BGF MB2', 'Ground Operations and Checklist', BPC_IPC, 20),
  makeGround('BGF CPT1', 'Checklist Procedures - Ground', BPC_IPC, 30),
  makeGround('BGF TUT1A', 'Ejection Seat Strap-in', BPC_IPC, 40),
  makeGround('BGF TUT1B', 'FTD Safety Brief', BPC_IPC, 50),
  makeGround('BGF TUT2', 'Flight Preparation, Checklist and Walkaround', BPC_IPC, 60),
  makeGround('BGF MB3', 'Effects of Controls; Attitude Flying; Straight and Level; Turning', BPC_IPC, 70),
  makeGround('BGF MB4', 'Climbing and Descending and Climbing and Descending Turns', BPC_IPC, 80),
  makeGround('BGF MB5', 'Re-join; Landing; Local Circuit Procedures', BPC_IPC, 90),
  makeGround('BGF MB6', 'Emergency Handling and Procedures', BPC_IPC, 100),
  makeGround('BGF CPT2', 'Airborne Procedures', BPC_IPC, 110),
  makeFTD('BGF FTD1', 'Strap in and Ground Procedures', BPC_IPC, 120),
  makeGround('BGF MB7', 'Normal Circuits', BPC_IPC, 130),
  makeFlight('BGF1', 'Effects of Controls; Attitude Flying; Straight and Level; Turning; Steep Turn', BPC_IPC, 140),
  makeFTD('BGF FTD2', 'Climbing; Descending; Climbing, Turning and Descending', BPC_IPC, 150),
  makeFlight('BGF2', 'Basic AP Operation; Climbing; Descending; Re-join; Landing', BPC_IPC, 160),
  makeGround('BGF MB8', 'Ground and Airborne Emergency Procedures', BPC_IPC, 170),
  makeGround('BGF CPT3', 'Emergency Procedures', BPC_IPC, 180),
  makeGround('BGF MB9', 'Wingover and Stalling', BPC_IPC, 190),
  makeGround('BGF TUT3', 'Stalling; Circuits', BPC_IPC, 200),
  makeFTD('BGF FTD3', 'Normal Circuits - Base & Final; Go Around; Wingovers; Clean Stalls; Accelerated Stall', BPC_IPC, 210),
  makeFlight('BGF3', 'Normal Circuit - Base and Final Technique; Go Around; Wingovers; Clean Stalls; Accelerated Stall', BPC_IPC, 220),
  makeFTD('BGF FTD4', 'Emergency Procedures; Normal Circuit', BPC_IPC, 230),
  makeFlight('BGF4', 'Configured Stalls; Normal Circuit', BPC_IPC, 240),
  makeFlight('BGF5', 'Consolidate Stalls and Circuits', BPC_IPC, 250),
  makeGround('BGF MB10', 'Abnormal Recovery', BPC_IPC, 260),
  makeGround('BGF MB11', 'Solo Malfunctions', BPC_IPC, 270),
  makeGround('BGF MB12', 'Solo Briefing', BPC_IPC, 280),
  makeGround('BGF CPT4', 'Emergency Procedures', BPC_IPC, 290),
  makeFlight('BGF6', 'Consolidate Circuits', BPC_IPC, 300),
  makeGround('BGF MB13', 'HUD Intro - Handling, Stalls, Normal CCT', BPC_IPC, 310),
  makeGround('BGF CPT5', 'HUD Intro', BPC_IPC, 320),
  makeGround('PRE-SOLO QUIZ', 'Pre-Solo Quiz', BPC_IPC, 330),
  makeFlight('BGF7', 'HUD Intro - Handling, Stalls, Normal Circuit; Demo Abnormal Landing', BPC_IPC, 340),
  makeFTD('BGF FTD5', 'Flapless & AIL PWR OFF S-l app; Circuit Consolidation', BPC_IPC, 350),
  makeFlight('BGF8', 'Flapless & AIL PWR OFF S-1 app; Consolidation', BPC_IPC, 360),
  makeGround('PERRT CPT1', 'Hypoxia', BPC_IPC, 370),
  makeFlight('BGF9', 'WSL Diversion; Controllability Check; Circuit Consolidation', BPC_IPC, 380),
  makeGround('BGF MB14', 'Low Level Circuit: Glide Circuit; Forced Landings', BPC_IPC, 390),
  makeFTD('BGF FTD6', 'Emergency Handling - Solo', BPC_IPC, 400),
  makeFlight('BGF10', 'Day Circuit Solo Check', BPC_IPC, 410, { cctOnly: 'YES' }),
  makeFlight('BGF11', 'Day Circuit Solo', BPC_IPC, 420, { sortieType: 'Solo', twrDiReqd: 'YES' }),
  makeGround('BGF MB15', 'G Warm Up; Basic Aerobatics; Unusual Attitude Recovery', BPC_IPC, 430),
  makeGround('BGF MB16', 'Spin Recovery', BPC_IPC, 440),
  makeFTD('BGF FTD7', 'Gliding; Glide Circuit; Low Level Circuit', BPC_IPC, 450),
  makeFlight('BGF12', 'Glide Circuit', BPC_IPC, 460),
  makeFlight('BGF13', 'Low Level Circuit', BPC_IPC, 470),
  makeFlight('BGF14', 'Unusual Attitude Recovery; G Warm Up; Wingover; Loop', BPC_IPC, 480),
  makeGround('BGF MB17', 'Barrel Roll; Aileron Roll', BPC_IPC, 490),
  makeFlight('BGF15', 'Aerobatics Consolidation', BPC_IPC, 500),
  makeGround('BGF MB18', 'Navigation Intro; Map Reading; Visual Waypoints', BPC_IPC, 510),
  makeFlight('BGF16', 'Navigation Introduction', BPC_IPC, 520),
  makeFlight('BGF17', 'Navigation Consolidation; Low Level', BPC_IPC, 530),
  makeGround('BGF MB19', 'Solo Navigation Briefing', BPC_IPC, 540),
  makeFlight('BGF18', 'Navigation Solo', BPC_IPC, 550, { sortieType: 'Solo', twrDiReqd: 'YES' }),
  makeGround('BGF MB20', 'Formation Intro Briefing', BPC_IPC, 560),
  makeFTD('BGF FTD8', 'Formation Intro FTD', BPC_IPC, 570),
  makeFlight('BGF19', 'Formation Introduction', BPC_IPC, 580),
  makeFlight('BGF20', 'Formation Consolidation', BPC_IPC, 590),
  makeFlight('BGF21', 'Final Handling Test (FHT)', BPC_IPC, 600),

  // ========== BIF Phase ==========
  makeGround('BIF MB1', 'Basic Instrument Flying Theory', BPC_IPC, 610),
  makeGround('BIF CPT1', 'Basic Instrument Procedures - CPT', BPC_IPC, 620),
  makeFTD('BIF FTD1', 'Basic Instrument Flying - FTD', BPC_IPC, 630),
  makeFlight('BIF1', 'Basic Instrument Flying - Dual', BPC_IPC, 640),
  makeFlight('BIF2', 'Basic IF Consolidation', BPC_IPC, 650),
  makeFlight('BIF3', 'Basic IF Check', BPC_IPC, 660),

  // ========== BNF Phase ==========
  makeGround('BNF MB1', 'Night Flying Theory and Procedures', BPC_IPC, 670),
  makeFTD('BNF FTD1', 'Night Flying - FTD', BPC_IPC, 680),
  makeFlight('BNF1', 'Night Flying Introduction', BPC_IPC, 690, { dayNight: 'Night' }),
  makeFlight('BNF2', 'Night Flying Consolidation', BPC_IPC, 700, { dayNight: 'Night' }),
  makeFlight('BNF3', 'Night Check', BPC_IPC, 710, { dayNight: 'Night' }),

  // ========== BNAV Phase ==========
  makeGround('BNAV MB1', 'Navigation Theory', BPC_IPC, 720),
  makeGround('BNAV MB2', 'Map Reading and Visual Waypoints', BPC_IPC, 730),
  makeFTD('BNAV FTD1', 'Navigation Simulator Exercise', BPC_IPC, 740),
  makeFlight('BNAV1', 'Navigation - Short Range', BPC_IPC, 750),
  makeFlight('BNAV2', 'Navigation Consolidation', BPC_IPC, 760),
  makeFlight('BNAV3', 'Navigation Solo Check', BPC_IPC, 770),
  makeFlight('BNAV4', 'Navigation Solo', BPC_IPC, 780, { sortieType: 'Solo', twrDiReqd: 'YES' }),

  // ========== FIC Phase ==========
  makeGround('FIC GND1', 'Instructional Techniques Theory', FIC_ONLY, 800),
  makeGround('FIC GND2', 'Teaching and Learning Principles', FIC_ONLY, 810),
  makeGround('FIC GND3', 'Lesson Planning and Preparation', FIC_ONLY, 820),
  makeGround('FIC CPT1', 'Instructional Procedures - CPT', FIC_ONLY, 830),
  makeFTD('FIC FTD1', 'Instructional Flying - FTD', FIC_ONLY, 840),
  makeFlight('FIC1', 'Instructional Flying - Effects of Controls', FIC_ONLY, 850),
  makeFlight('FIC2', 'Instructional Flying - Circuits', FIC_ONLY, 860),
  makeFlight('FIC3', 'Instructional Flying - Navigation', FIC_ONLY, 870),
  makeFlight('FIC4', 'Instructional Flying - Instruments', FIC_ONLY, 880),
  makeFlight('FIC5', 'FIC Progress Check', FIC_ONLY, 890),
  makeFlight('FIC6', 'FIC Final Handling Test', FIC_ONLY, 900),
];

export async function GET(request: NextRequest) {
  // Check secret
  const SEED_SECRET = getSeedSecret();
  const secret = request.nextUrl.searchParams.get('secret');
  if (!SEED_SECRET) {
    return NextResponse.json(
      { error: 'SEED_SECRET is not configured' },
      { status: 503 }
    );
  }
  if (secret !== SEED_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide ?secret=YOUR_SECRET' },
      { status: 401 }
    );
  }

  const force = request.nextUrl.searchParams.get('force') === 'true';

  try {
    // Check if already seeded
    const existingCount = await prisma.syllabusItem.count();
    if (existingCount > 0 && !force) {
      // Check if existing items use wrong codes
      const firstItem = await prisma.syllabusItem.findFirst({ orderBy: { sortOrder: 'asc' } });
      const usesWrongCodes = firstItem && firstItem.code.includes('_');
      return NextResponse.json({
        success: true,
        message: existingCount > 0
          ? `Database has ${existingCount} syllabus items${usesWrongCodes ? ' (WARNING: using wrong codes like BGF_GND_001 - use ?force=true to fix)' : ' with correct codes'}. Use ?force=true to re-seed.`
          : 'No items found.',
        count: existingCount,
        firstItemCode: firstItem?.code,
        needsReseed: usesWrongCodes,
        skipped: !usesWrongCodes,
      });
    }

    // If force, delete existing items first
    if (existingCount > 0) {
      await prisma.syllabusItem.deleteMany({});
      try { await prisma.syllabusHistory.deleteMany({}); } catch (e) {}
    }

    // Create all items
    let created = 0;
    const errors: string[] = [];

    for (const item of SYLLABUS_ITEMS) {
      try {
        await prisma.syllabusItem.create({ data: item as any });
        created++;
      } catch (err: any) {
        errors.push(`${item.code}: ${err.message}`);
      }
    }

    // Log to history
    if (created > 0) {
      try {
        await prisma.syllabusHistory.create({
          data: {
            syllabusItemId: 'bulk-seed',
            changeType: 'SEED',
            changeData: { itemsCreated: created, seededAt: new Date().toISOString(), codeStyle: 'matching-scores' } as any,
            changedBy: 'seed-api',
            changeReason: 'Re-seed with correct codes matching PT-051 score records (BGF1, BGF MB1, BGF FTD1, etc.)',
          },
        });
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${created} syllabus items with codes matching PT-051 score records`,
      created,
      total: SYLLABUS_ITEMS.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
