import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple security: require a secret key in the request header or query param
// Set SEED_SECRET env var in Railway to secure this endpoint
const SEED_SECRET = process.env.SEED_SECRET || 'dfp-seed-2026';

function createSyllabusItem(code: string, overrides: any = {}) {
  const parts = code.split('_');
  const courseCode = parts[0];
  const phaseMap: Record<string, string> = {
    BGF: 'Basic Ground Flying', BIF: 'Basic Instrument Flying',
    BNF: 'Basic Navigation Flying', BNAV: 'Basic Navigation',
    FIC: 'Flight Instructor Course',
  };
  const phase = phaseMap[courseCode] || courseCode;
  const typeFromCode = code.includes('_SIM_') ? 'Simulator' :
    code.includes('_GND_') ? 'Ground' :
    code.includes('_BRIEF_') ? 'Briefing' : 'Flying';

  return {
    code,
    eventDescription: overrides.eventDescription || code.replace(/_/g, ' '),
    phase: overrides.phase || phase,
    module: overrides.module || courseCode,
    type: overrides.type || typeFromCode,
    sortieType: overrides.sortieType || null,
    dayNight: overrides.dayNight || 'Day',
    courses: overrides.courses || [courseCode],
    methodOfDelivery: overrides.methodOfDelivery || ['Instructor Led'],
    methodOfAssessment: overrides.methodOfAssessment || ['Instructor Assessment'],
    resourcesPhysical: overrides.resourcesPhysical || [],
    resourcesHuman: overrides.resourcesHuman || ['QFI'],
    eventDetailsCommon: overrides.eventDetailsCommon || [],
    eventDetailsSortie: overrides.eventDetailsSortie || [],
    flightOrSimHours: overrides.flightOrSimHours || 0,
    totalEventHours: overrides.totalEventHours || 1,
    duration: overrides.duration || 1,
    preFlightTime: overrides.preFlightTime || 0,
    postFlightTime: overrides.postFlightTime || 0,
    prerequisites: overrides.prerequisites || [],
    prerequisitesGround: overrides.prerequisitesGround || [],
    prerequisitesFlying: overrides.prerequisitesFlying || [],
    location: overrides.location || null,
    sortOrder: overrides.sortOrder || 0,
    lmpType: overrides.lmpType || null,
    twrDiReqd: overrides.twrDiReqd || null,
    cctOnly: overrides.cctOnly || null,
    isRemedial: overrides.isRemedial || false,
    isActive: true,
    version: 1,
    notes: overrides.notes || null,
    createdBy: 'seed-api',
  };
}

export async function GET(request: NextRequest) {
  // Check secret
  const secret = request.nextUrl.searchParams.get('secret');
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
      return NextResponse.json({
        success: true,
        message: `Database already has ${existingCount} syllabus items. Use ?force=true to re-seed.`,
        count: existingCount,
        skipped: true,
      });
    }

    const items = [
      // BGF items
      createSyllabusItem('BGF_GND_001', { eventDescription: 'Air Law and Regulations', type: 'Ground', sortOrder: 10, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BGF_GND_002', { eventDescription: 'Meteorology Fundamentals', type: 'Ground', sortOrder: 20, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BGF_GND_003', { eventDescription: 'Navigation Principles', type: 'Ground', sortOrder: 30, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BGF_GND_004', { eventDescription: 'Aircraft Systems - General', type: 'Ground', sortOrder: 40, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BGF_GND_005', { eventDescription: 'Flight Planning Basics', type: 'Ground', sortOrder: 50, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BGF_SIM_001', { eventDescription: 'Simulator Familiarisation', type: 'Simulator', sortOrder: 60, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_SIM_002', { eventDescription: 'Basic Aircraft Handling - Simulator', type: 'Simulator', sortOrder: 70, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_001', { eventDescription: 'Aircraft Familiarisation', type: 'Flying', sortOrder: 80, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_002', { eventDescription: 'Effects of Controls', type: 'Flying', sortOrder: 90, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_003', { eventDescription: 'Straight and Level Flight', type: 'Flying', sortOrder: 100, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_004', { eventDescription: 'Climbing and Descending', type: 'Flying', sortOrder: 110, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_005', { eventDescription: 'Medium Level Turns', type: 'Flying', sortOrder: 120, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_006', { eventDescription: 'Stalling', type: 'Flying', sortOrder: 130, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_007', { eventDescription: 'Circuit Training', type: 'Flying', sortOrder: 140, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_008', { eventDescription: 'First Solo', type: 'Flying', sortOrder: 150, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_009', { eventDescription: 'Advanced Circuits', type: 'Flying', sortOrder: 160, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_010', { eventDescription: 'Navigation Exercise 1', type: 'Flying', sortOrder: 170, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_011', { eventDescription: 'Navigation Exercise 2', type: 'Flying', sortOrder: 180, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_012', { eventDescription: 'BGF Progress Check', type: 'Flying', sortOrder: 190, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BGF_FLT_013', { eventDescription: 'BGF Final Handling Test', type: 'Flying', sortOrder: 200, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),

      // BIF items
      createSyllabusItem('BIF_GND_001', { eventDescription: 'Instrument Flight Rules Theory', type: 'Ground', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 210, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BIF_GND_002', { eventDescription: 'Instrument Meteorological Conditions', type: 'Ground', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 220, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BIF_GND_003', { eventDescription: 'Instrument Scanning Techniques', type: 'Ground', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 230, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BIF_SIM_001', { eventDescription: 'Instrument Flying - Simulator 1', type: 'Simulator', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 240, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_SIM_002', { eventDescription: 'Instrument Flying - Simulator 2', type: 'Simulator', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 250, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_SIM_003', { eventDescription: 'Instrument Flying - Simulator 3', type: 'Simulator', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 260, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_FLT_001', { eventDescription: 'Basic Instrument Flying 1', type: 'Flying', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 270, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_FLT_002', { eventDescription: 'Basic Instrument Flying 2', type: 'Flying', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 280, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_FLT_003', { eventDescription: 'Basic Instrument Flying 3', type: 'Flying', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 290, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_FLT_004', { eventDescription: 'Instrument Navigation Exercise', type: 'Flying', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 300, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_FLT_005', { eventDescription: 'BIF Progress Check', type: 'Flying', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 310, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BIF_FLT_006', { eventDescription: 'BIF Final Instrument Test', type: 'Flying', phase: 'Basic Instrument Flying', module: 'BIF', courses: ['BIF'], sortOrder: 320, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),

      // BNF items
      createSyllabusItem('BNF_GND_001', { eventDescription: 'Advanced Navigation Theory', type: 'Ground', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 330, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BNF_GND_002', { eventDescription: 'Map Reading and Chart Work', type: 'Ground', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 340, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BNF_SIM_001', { eventDescription: 'Navigation Simulator Exercise 1', type: 'Simulator', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 350, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNF_SIM_002', { eventDescription: 'Navigation Simulator Exercise 2', type: 'Simulator', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 360, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNF_FLT_001', { eventDescription: 'Solo Navigation Exercise 1', type: 'Flying', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 370, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNF_FLT_002', { eventDescription: 'Solo Navigation Exercise 2', type: 'Flying', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 380, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNF_FLT_003', { eventDescription: 'Navigation Cross Country 1', type: 'Flying', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 390, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNF_FLT_004', { eventDescription: 'Navigation Cross Country 2', type: 'Flying', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 400, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNF_FLT_005', { eventDescription: 'BNF Progress Check', type: 'Flying', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 410, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNF_FLT_006', { eventDescription: 'BNF Final Navigation Test', type: 'Flying', phase: 'Basic Navigation Flying', module: 'BNF', courses: ['BNF'], sortOrder: 420, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 }),

      // BNAV items
      createSyllabusItem('BNAV_GND_001', { eventDescription: 'Advanced Navigation Systems', type: 'Ground', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 430, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BNAV_GND_002', { eventDescription: 'GPS and Electronic Navigation', type: 'Ground', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 440, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BNAV_GND_003', { eventDescription: 'Flight Planning - Advanced', type: 'Ground', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 450, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('BNAV_SIM_001', { eventDescription: 'Advanced Navigation Simulator 1', type: 'Simulator', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 460, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNAV_SIM_002', { eventDescription: 'Advanced Navigation Simulator 2', type: 'Simulator', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 470, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNAV_FLT_001', { eventDescription: 'Advanced Navigation Flight 1', type: 'Flying', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 480, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNAV_FLT_002', { eventDescription: 'Advanced Navigation Flight 2', type: 'Flying', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 490, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('BNAV_FLT_003', { eventDescription: 'BNAV Final Test', type: 'Flying', phase: 'Basic Navigation', module: 'BNAV', courses: ['BNAV'], sortOrder: 500, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 }),

      // FIC items
      createSyllabusItem('FIC_GND_001', { eventDescription: 'Instructional Techniques', type: 'Ground', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 510, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('FIC_GND_002', { eventDescription: 'Teaching and Learning Theory', type: 'Ground', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 520, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('FIC_GND_003', { eventDescription: 'Lesson Planning', type: 'Ground', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 530, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('FIC_GND_004', { eventDescription: 'Airmanship and Airspace', type: 'Ground', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 540, totalEventHours: 2, duration: 2 }),
      createSyllabusItem('FIC_SIM_001', { eventDescription: 'Instructional Simulator Exercise 1', type: 'Simulator', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 550, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('FIC_SIM_002', { eventDescription: 'Instructional Simulator Exercise 2', type: 'Simulator', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 560, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('FIC_FLT_001', { eventDescription: 'Instructional Flying - Effects of Controls', type: 'Flying', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 570, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('FIC_FLT_002', { eventDescription: 'Instructional Flying - Circuits', type: 'Flying', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 580, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('FIC_FLT_003', { eventDescription: 'Instructional Flying - Navigation', type: 'Flying', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 590, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('FIC_FLT_004', { eventDescription: 'Instructional Flying - Instruments', type: 'Flying', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 600, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('FIC_FLT_005', { eventDescription: 'FIC Progress Check', type: 'Flying', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 610, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
      createSyllabusItem('FIC_FLT_006', { eventDescription: 'FIC Final Handling Test', type: 'Flying', phase: 'Flight Instructor Course', module: 'FIC', courses: ['FIC'], sortOrder: 620, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 }),
    ];

    // If force, delete existing items first
    if (force && existingCount > 0) {
      await prisma.syllabusItem.deleteMany({});
      await prisma.syllabusHistory.deleteMany({});
    }

    // Create all items
    let created = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        await prisma.syllabusItem.create({ data: item });
        created++;
      } catch (err: any) {
        errors.push(`${item.code}: ${err.message}`);
      }
    }

    // Log to history
    if (created > 0) {
      await prisma.syllabusHistory.create({
        data: {
          syllabusItemId: 'bulk-seed',
          changeType: 'SEED',
          changeData: { itemsCreated: created, seededAt: new Date().toISOString() },
          changedBy: 'seed-api',
          changeReason: 'Initial database seed via API',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${created} syllabus items`,
      created,
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