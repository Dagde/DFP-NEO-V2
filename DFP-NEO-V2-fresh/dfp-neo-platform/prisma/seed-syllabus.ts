/**
 * Syllabus Seed Script
 * Migrates syllabus items into the SyllabusItem database table.
 * Run with: npm run db:seed-syllabus
 * Force re-seed: npm run db:seed-syllabus-force
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SyllabusItemSeed {
  code: string;
  eventDescription: string;
  phase: string;
  module: string;
  type: 'Flight' | 'FTD' | 'Ground School';
  sortieType?: 'Dual' | 'Solo';
  dayNight: 'Day' | 'Night' | 'Day/Night';
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
  lmpType?: 'Master LMP' | 'Staff CAT';
  twrDiReqd?: 'YES' | 'NO';
  cctOnly?: 'YES' | 'NO';
  isRemedial: boolean;
  isActive: boolean;
}

function createSyllabusItem(
  code: string,
  description: string,
  courses: string[] = ['BPC+IPC'],
  overrides: Partial<SyllabusItemSeed> = {}
): SyllabusItemSeed {
  code = code || '';
  description = description || '';

  let phase = 'BGF';
  if (code.startsWith('BIF')) phase = 'BIF';
  else if (code.startsWith('BNF')) phase = 'BNF';
  else if (code.startsWith('BNAV')) phase = 'BNAV';
  else if (code.startsWith('FIC')) phase = 'FIC';
  else if (code.startsWith('AIT')) phase = 'FIC';
  else if (code.startsWith('WSO')) phase = 'WSO';
  else if (code.startsWith('OFI')) phase = 'OFI';

  let module = 'Basic General Flying';
  if (phase === 'BIF') module = 'Basic Instrument Flying';
  else if (phase === 'BNF') module = 'Basic Night Flying';
  else if (phase === 'BNAV') module = 'Basic Navigation';
  else if (phase === 'FIC') module = 'Flight Instructor Course';
  else if (phase === 'WSO') module = 'Weapons Systems Officer';
  else if (phase === 'OFI') module = 'Operational Flying Instructor';

  let methodOfDelivery: string[] = [];
  let flightOrSimHours = 0;
  let totalEventHours = 0;
  let type: 'Flight' | 'FTD' | 'Ground School' = 'Flight';
  let sortieType: 'Dual' | 'Solo' = 'Dual';
  let preFlightTime = 0;
  let postFlightTime = 0;
  let location = '';

  if (code.includes('FTD')) {
    methodOfDelivery = ['FTD', 'Brief', 'Debrief'];
    flightOrSimHours = 2.0;
    totalEventHours = 2.5;
    type = 'FTD';
    preFlightTime = 40 / 60;
    postFlightTime = 30 / 60;
    location = 'FTD Complex';
  } else if (code.includes('CPT')) {
    methodOfDelivery = ['CPT', 'Brief'];
    flightOrSimHours = 1.0;
    totalEventHours = 1.5;
    type = 'Ground School';
    preFlightTime = 15 / 60;
    postFlightTime = 15 / 60;
    location = 'CPT Rooms';
  } else if (code.includes('MB') || code.includes('TUT') || code.includes('QUIZ') || code.includes('Lec')) {
    methodOfDelivery = ['Classroom', 'Brief'];
    flightOrSimHours = 0;
    totalEventHours = 1.0;
    type = 'Ground School';
    preFlightTime = 0.0;
    postFlightTime = 0;
    location = 'Classrooms';
  } else {
    methodOfDelivery = ['Aircraft', 'Brief', 'Debrief'];
    if (code.startsWith('BNF')) {
      flightOrSimHours = 1.0;
      totalEventHours = 2.5;
    } else {
      flightOrSimHours = 1.2;
      totalEventHours = 3.0;
    }
    type = 'Flight';
    sortieType = ['BGF11', 'BGF18'].includes(code) ? 'Solo' : 'Dual';
    preFlightTime = 75 / 60;
    postFlightTime = 30 / 60;
    location = 'Airfield';
  }

  const cleanedDescription = (description || '').replace(/\n/g, ' ').replace(/;/g, '; ').replace(/\s\s+/g, ' ').trim();
  const eventDetails = cleanedDescription.split(';').map((s: string) => s.trim()).filter(Boolean);
  const itemCode = (code || '').replace('*', '');
  const isGround = type === 'Ground School';
  const dayNight: 'Day' | 'Night' | 'Day/Night' =
    code.startsWith('BNF') || code === 'Night SCT' ? 'Night' : 'Day';

  return {
    code: itemCode,
    eventDescription: description,
    phase,
    module,
    type,
    sortieType,
    dayNight,
    courses,
    methodOfDelivery,
    methodOfAssessment: ['Practical Assessment', 'Debrief'],
    resourcesPhysical: methodOfDelivery.includes('Aircraft')
      ? ['PC-21 Aircraft']
      : methodOfDelivery.includes('FTD')
      ? ['PC-21 FTD']
      : ['Classroom'],
    resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
    eventDetailsCommon: eventDetails,
    eventDetailsSortie: [],
    flightOrSimHours,
    totalEventHours,
    duration: isGround ? totalEventHours : flightOrSimHours,
    preFlightTime,
    postFlightTime,
    prerequisites: [],
    prerequisitesGround: [],
    prerequisitesFlying: [],
    location,
    sortOrder: 0,
    twrDiReqd: (code === 'BGF11' || code === 'BGF18') ? 'YES' : 'NO',
    cctOnly: code === 'BGF10' ? 'YES' : 'NO',
    isRemedial: false,
    isActive: true,
    ...overrides,
  };
}

function populatePrerequisites(items: SyllabusItemSeed[]): SyllabusItemSeed[] {
  return items.map((item, index, arr) => {
    const hasExplicitPrereqs =
      (item.prerequisitesGround && item.prerequisitesGround.length > 0) ||
      (item.prerequisitesFlying && item.prerequisitesFlying.length > 0);

    if (hasExplicitPrereqs || item.lmpType === 'Master LMP') return item;

    const prerequisitesGround: string[] = [];
    const prerequisitesFlying: string[] = [];

    for (let i = index - 1; i >= 0; i--) {
      const prereqCandidate = arr[i];
      if (prereqCandidate.code.includes(' MB')) continue;
      const sharedCourses = prereqCandidate.courses.some((c: string) => item.courses.includes(c));
      if (!sharedCourses) break;
      if (prereqCandidate.type === 'Flight' || prereqCandidate.type === 'FTD') {
        prerequisitesFlying.push(prereqCandidate.code);
      } else {
        prerequisitesGround.push(prereqCandidate.code);
      }
      break;
    }

    return { ...item, prerequisitesGround, prerequisitesFlying, prerequisites: [...prerequisitesGround, ...prerequisitesFlying] };
  });
}

// All syllabus items - mirrors INITIAL_SYLLABUS_DETAILS from mockData.ts
const syllabusItemsRaw: SyllabusItemSeed[] = [
  // BPC + IPC Items
  createSyllabusItem('BGF MB1', 'Preparation and Pre / Post Flight Admin'),
  createSyllabusItem('BGF MB2', 'Ground Operations and Checklist'),
  createSyllabusItem('BGF CPT1', 'Checklist Procedures - Ground'),
  createSyllabusItem('BGF TUT1A', 'Ejection Seat Strap-in'),
  createSyllabusItem('BGF TUT1B', 'FTD Safety Brief'),
  createSyllabusItem('BGF TUT2', 'Flight Preparation, Checklist and Walkaround'),
  createSyllabusItem('BGF MB3', 'Effects of Controls; Attitude Flying; Straight and Level; Turning'),
  createSyllabusItem('BGF MB4', 'Climbing and Descending and Climbing and Descending Turns'),
  createSyllabusItem('BGF MB5', 'Re-join; Landing; Local Circuit Procedures'),
  createSyllabusItem('BGF MB6', 'Emergency Handling and Procedures'),
  createSyllabusItem('BGF CPT2', 'Airborne Procedures'),
  createSyllabusItem('BGF FTD1', 'Strap in and Ground Procedures'),
  createSyllabusItem('BGF MB7', 'Normal Circuits'),
  createSyllabusItem('BGF1', 'Effects of Controls; Attitude Flying; Straight and Level; Turning; Steep Turn'),
  createSyllabusItem('BGF FTD2', 'Climbing; Descending; Climbing, Turning and Descending'),
  createSyllabusItem('BGF2', 'Basic AP Operation; Climbing; Descending; Climbing, Turning and Descending; Re-join; Landing'),
  createSyllabusItem('BGF MB8', 'Ground and Airborne Emergency Procedures'),
  createSyllabusItem('BGF CPT3', 'Emergency Procedures'),
  createSyllabusItem('BGF MB9', 'Wingover and Stalling'),
  createSyllabusItem('BGF TUT3', 'Stalling; Circuits'),
  createSyllabusItem('BGF FTD3', 'Normal Circuits - Base & Final; Go Around; Wingovers; Clean Stalls; Accelerated Stall'),
  createSyllabusItem('BGF3', 'Normal Circuit - Base and Final Technique; Go Around; Wingovers; Clean Stalls; Accelerated Stall'),
  createSyllabusItem('BGF FTD4', 'Emergency Procedures; Normal Circuit'),
  createSyllabusItem('BGF4', 'Configured Stalls; Normal Circuit'),
  createSyllabusItem('BGF5', 'Consolidate Stalls and Circuits'),
  createSyllabusItem('BGF MB10', 'Abnormal Recovery'),
  createSyllabusItem('BGF MB11', 'Solo Malfunctions'),
  createSyllabusItem('BGF MB12', 'Solo Briefing'),
  createSyllabusItem('BGF CPT4', 'Emergency Procedures'),
  createSyllabusItem('BGF6', 'Consolidate Circuits'),
  createSyllabusItem('BGF MB13', 'HUD Intro - Handling, Stalls, Normal CCT'),
  createSyllabusItem('BGF CPT5', 'HUD Intro'),
  createSyllabusItem('PRE-SOLO QUIZ', 'Pre-Solo Quiz'),
  createSyllabusItem('BGF7', 'HUD Intro - Handling, Stalls, Normal Circuit; Demo Abnormal Landing'),
  createSyllabusItem('BGF FTD5', 'Flapless & AIL PWR OFF S-l app; Circuit Consolidation'),
  createSyllabusItem('BGF8', 'Flapless & AIL PWR OFF S-1 app; Consolidation'),
  createSyllabusItem('PERRT CPT1', 'Hypoxia'),
  createSyllabusItem('BGF9', 'WSL Diversion; Controllability Check; Circuit Consolidation'),
  createSyllabusItem('BGF MB14', 'Low Level Circuit: Glide Circuit; Forced Landings'),
  createSyllabusItem('BGF FTD6', 'Emergency Handling - Solo'),
  createSyllabusItem('BGF10', 'Day Circuit Solo Check'),
  createSyllabusItem('BGF11', 'Day Circuit Solo'),
  createSyllabusItem('BGF MB15', 'G Warm Up; Basic Aerobatics; Unusual Attitude Recovery'),
  createSyllabusItem('BGF MB16', 'Spin Recovery'),
  createSyllabusItem('BGF FTD7', 'Gliding; Glide Circuit; Low Level Circuit'),
  createSyllabusItem('BGF12', 'Glide Circuit'),
  createSyllabusItem('BGF13', 'Low Level Circuit'),
  createSyllabusItem('BGF14', 'Unusual Attitude Recovery; G Warm Up; Wingover; Loop'),
  createSyllabusItem('BGF MB17', 'Barrel Roll; Aileron Roll'),
  createSyllabusItem('BGF15', 'Aerobatics Consolidation'),
  createSyllabusItem('BGF MB18', 'Navigation Intro; Map Reading; Visual Waypoints'),
  createSyllabusItem('BGF16', 'Navigation Introduction'),
  createSyllabusItem('BGF17', 'Navigation Consolidation; Low Level'),
  createSyllabusItem('BGF MB19', 'Solo Navigation Briefing'),
  createSyllabusItem('BGF18', 'Navigation Solo'),
  createSyllabusItem('BGF MB20', 'Formation Intro Briefing'),
  createSyllabusItem('BGF FTD8', 'Formation Intro FTD'),
  createSyllabusItem('BGF19', 'Formation Introduction'),
  createSyllabusItem('BGF20', 'Formation Consolidation'),
  createSyllabusItem('BGF21', 'Final Handling Test (FHT)'),
  // BIF Items
  createSyllabusItem('BIF MB1', 'Basic Instrument Flying Theory'),
  createSyllabusItem('BIF CPT1', 'Basic Instrument Procedures - CPT'),
  createSyllabusItem('BIF FTD1', 'Basic Instrument Flying - FTD'),
  createSyllabusItem('BIF1', 'Basic Instrument Flying - Dual'),
  createSyllabusItem('BIF2', 'Basic IF Consolidation'),
  createSyllabusItem('BIF3', 'Basic IF Check'),
  // BNF Items
  createSyllabusItem('BNF MB1', 'Night Flying Theory and Procedures', ['BPC+IPC']),
  createSyllabusItem('BNF FTD1', 'Night Flying - FTD', ['BPC+IPC']),
  createSyllabusItem('BNF1', 'Night Flying Introduction', ['BPC+IPC']),
  createSyllabusItem('BNF2', 'Night Circuit Consolidation', ['BPC+IPC']),
  createSyllabusItem('BNF3', 'Night Navigation', ['BPC+IPC']),
  // BNAV Items
  createSyllabusItem('BNAV MB1', 'Navigation Theory and Planning'),
  createSyllabusItem('BNAV1', 'Navigation Introduction'),
  createSyllabusItem('BNAV2', 'Navigation Consolidation'),
  createSyllabusItem('BNAV3', 'Low Level Navigation'),
  createSyllabusItem('BNAV4', 'Navigation Check'),
  // FIC Items
  { ...createSyllabusItem('FIC1', 'Introduction to Military Flight Instruction', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Introduction to military flight instruction. Covers instructional theory, adult learning principles, lesson planning frameworks, and the standards required of a qualified flying instructor (QFI). Trainee will understand the role and responsibilities of an instructor on the PC-21.' },
  { ...createSyllabusItem('FIC2', 'Instructional Patter and Right Seat Procedures', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Detailed study of instructional patter, two-crew communication standards, and right-hand seat operating procedures.' },
  { ...createSyllabusItem('FIC FTD1', 'Circuit Patter Development - FTD', ['FIC']), lmpType: 'Master LMP', eventDescription: 'First simulator instructional sortie. Trainee practices right-hand seat familiarisation, cockpit management, and delivery of circuit patter.' },
  { ...createSyllabusItem('FIC FTD2', 'General Handling Patter - FTD', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Simulator patter development for general handling.' },
  { ...createSyllabusItem('FIC3', 'General Handling Instruction - Airborne', ['FIC']), lmpType: 'Master LMP', eventDescription: 'First airborne instructional sortie. Trainee flies from the right-hand seat.' },
  { ...createSyllabusItem('FIC4', 'Circuit Instruction - Airborne', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Instructional sortie focusing on teaching circuit patterns and take-off and landing sequences.' },
  { ...createSyllabusItem('FIC5', 'Advanced General Handling Instruction', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Advanced general handling instructional sortie.' },
  { ...createSyllabusItem('FIC FTD3', 'Emergency Procedures Patter - FTD', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Simulator patter development for emergency procedures instruction.' },
  { ...createSyllabusItem('FIC6', 'Aerobatics Instruction', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Instructional sortie covering aerobatic instruction technique.' },
  { ...createSyllabusItem('FIC7', 'Integrated Instructional Sortie', ['FIC']), lmpType: 'Master LMP', eventDescription: 'Advanced instructional sortie integrating multiple exercise areas.' },
  { ...createSyllabusItem('FIC8', 'Final Instructional Assessment', ['FIC']), lmpType: 'Master LMP', eventDescription: 'FIC core flying phase consolidation sortie.' },
];

const syllabusItems = populatePrerequisites(syllabusItemsRaw).map((item, index) => ({
  ...item,
  sortOrder: index,
}));

async function seedSyllabus() {
  console.log('📚 Starting SyllabusItem database seeding...');
  console.log(`   Found ${syllabusItems.length} syllabus items to seed`);

  const existing = await prisma.syllabusItem.count();
  if (existing > 0) {
    console.log(`⚠️  Database already has ${existing} syllabus items.`);
    if (!process.argv.includes('--force')) {
      console.log('   Run with --force flag to re-seed. Exiting.');
      return;
    }
    console.log('   --force flag detected. Clearing existing items...');
    await prisma.syllabusItem.deleteMany();
  }

  let created = 0;
  let failed = 0;

  for (const item of syllabusItems) {
    try {
      await prisma.syllabusItem.create({
        data: {
          code: item.code,
          eventDescription: item.eventDescription,
          phase: item.phase,
          module: item.module,
          type: item.type,
          sortieType: item.sortieType ?? null,
          dayNight: item.dayNight,
          courses: item.courses,
          methodOfDelivery: item.methodOfDelivery,
          methodOfAssessment: item.methodOfAssessment,
          resourcesPhysical: item.resourcesPhysical,
          resourcesHuman: item.resourcesHuman,
          eventDetailsCommon: item.eventDetailsCommon,
          eventDetailsSortie: item.eventDetailsSortie,
          flightOrSimHours: item.flightOrSimHours,
          totalEventHours: item.totalEventHours,
          duration: item.duration,
          preFlightTime: item.preFlightTime,
          postFlightTime: item.postFlightTime,
          prerequisites: item.prerequisites,
          prerequisitesGround: item.prerequisitesGround,
          prerequisitesFlying: item.prerequisitesFlying,
          location: item.location ?? '',
          sortOrder: item.sortOrder,
          lmpType: item.lmpType ?? null,
          twrDiReqd: item.twrDiReqd ?? null,
          cctOnly: item.cctOnly ?? null,
          isRemedial: item.isRemedial,
          isActive: item.isActive,
          version: 1,
          createdBy: 'system-seed',
          notes: 'Initial seed from INITIAL_SYLLABUS_DETAILS',
        },
      });
      created++;
      process.stdout.write(`\r   Seeded: ${created}/${syllabusItems.length}`);
    } catch (error: any) {
      console.error(`\n❌ Failed to seed item ${item.code}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n\n✅ Seeding complete! Created: ${created} items${failed > 0 ? `, Failed: ${failed}` : ''}`);

  // Log to history
  const seededItems = await prisma.syllabusItem.findMany({ select: { id: true, code: true } });
  for (const item of seededItems) {
    await prisma.syllabusHistory.create({
      data: {
        syllabusItemId: item.id,
        changeType: 'CREATE',
        changeData: { code: item.code },
        changedBy: 'system-seed',
        changeReason: 'Initial migration from mockData.ts INITIAL_SYLLABUS_DETAILS',
      },
    });
  }

  console.log(`   History records created: ${seededItems.length}`);
  console.log('\n🎉 SyllabusItem table is ready!');
}

seedSyllabus()
  .catch((error) => { console.error('❌ Seed failed:', error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });