
import { v4 as uuidv4 } from 'uuid';
import { Instructor, Trainee, ScheduleEvent, SyllabusItemDetail, Score, TraineeRank, InstructorRank, InstructorCategory, Course, Pt051Assessment, PhraseBank } from './types';

// ===================================================================================
// --- SHARED DATA ---
// ===================================================================================

const createSyllabusItem = (
    code: string,
    description: string,
    courses: string[] = ['BPC+IPC'] // Default to the standard pilot course
): SyllabusItemDetail => {
    // Safety checks for undefined parameters with error tracking
    if (!code) {
        console.error('❌ ERROR: createSyllabusItem called with undefined/null code parameter');
        console.trace();
    }
    if (!description) {
        console.error('❌ ERROR: createSyllabusItem called with undefined/null description parameter');
        console.trace();
    }
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
        flightOrSimHours = 2.0;  // BPC+IPC FTD events: 2.0hrs
        totalEventHours = 2.5;
        type = 'FTD';
        preFlightTime = 40 / 60; // 40 minutes
        postFlightTime = 30 / 60; // 30 minutes
        location = 'FTD Complex';
    } else if (code.includes('CPT')) {
        methodOfDelivery = ['CPT', 'Brief'];
        flightOrSimHours = 1.0;
        totalEventHours = 1.5;
        type = 'Ground School';
        preFlightTime = 15 / 60; // 15 minutes
        postFlightTime = 15 / 60; // 15 minutes
        location = 'CPT Rooms';
    } else if (code.includes('MB') || code.includes('TUT') || code.includes('QUIZ') || code.includes('Lec')) {
        methodOfDelivery = ['Classroom', 'Brief'];
        flightOrSimHours = 0;
        totalEventHours = 1.0;
        type = 'Ground School';
        preFlightTime = 0.0; 
        postFlightTime = 0;
        location = 'Classrooms';
    } else { // It's a flight
        methodOfDelivery = ['Aircraft', 'Brief', 'Debrief'];
        if (code.startsWith('BNF')) {
            flightOrSimHours = 1.0;
            totalEventHours = 2.5; 
        } else {
            flightOrSimHours = 1.2;  // BPC+IPC flight events: 1.2hrs
            totalEventHours = 3.0;
        }
        type = 'Flight';
        
        if (['BGF11', 'BGF18'].includes(code)) {
             sortieType = 'Solo';
        } else {
             sortieType = 'Dual';
        }

        preFlightTime = 75 / 60; // 75 minutes (1.25 hours)
        postFlightTime = 30 / 60; // 30 minutes (0.5 hours)
        location = 'Airfield';
    }

    const cleanedDescription = (description || "").replace(/\n/g, ' ').replace(/;/g, '; ').replace(/\s\s+/g, ' ').trim();
    const eventDetails = cleanedDescription.split(';').map(s => s.trim()).filter(Boolean);
    const itemCode = (code || "").replace('*', '');
    
    const isGround = type === 'Ground School';
    
    // Determine Day/Night classification
    // BNF events are Night flights, Night SCT is Night, all others are Day by default
    const dayNight: 'Day' | 'Night' | 'Day/Night' = 
        code.startsWith('BNF') || code === 'Night SCT' ? 'Night' : 'Day';

    return {
        id: itemCode,
        code: itemCode,
        dayNight,
        phase,
        module,
        eventDescription: description,
        prerequisites: [],
        prerequisitesGround: [],
        prerequisitesFlying: [],
        eventDetailsCommon: eventDetails,
        eventDetailsSortie: [],
        totalEventHours,
        flightOrSimHours,
        duration: isGround ? totalEventHours : flightOrSimHours,
        preFlightTime,
        postFlightTime,
        type,
        sortieType,
           twrDiReqd: (code === 'BGF11' || code === 'BGF18') ? 'YES' : 'NO',
           cctOnly: (code === 'BGF10') ? 'YES' : 'NO',
        location,
        methodOfDelivery,
        methodOfAssessment: ['Practical Assessment', 'Debrief'],
        resourcesPhysical: methodOfDelivery.includes('Aircraft') ? ['PC-21 Aircraft'] : methodOfDelivery.includes('FTD') ? ['PC-21 FTD'] : ['Classroom'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        courses,
    };
};

const syllabusItems: SyllabusItemDetail[] = [
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
    createSyllabusItem('BGF FTD8', 'Practice Forced Landing'),
    createSyllabusItem('BGF15', 'U/A NH NCR; Aileron Roll, Incipient Spin'),
    createSyllabusItem('AREA SOLO QUIZ', 'Area Solo Quiz'),
    createSyllabusItem('BGF16', 'Spin Recovery; PFL Area'),
    createSyllabusItem('BGF TUT4', 'Glide Circuit; Practice Forced Landing; Spinning; G Stall; G Warm Up; Basic Aerobatics; Unusual Attitude Recovery'),
    createSyllabusItem('BGF FTD9', 'Emergency Handling - Area Solo'),
    createSyllabusItem('BGF17', 'Area Solo Check'),
    createSyllabusItem('BGF18', 'Area Solo'),
    createSyllabusItem('BGF19', 'GF Consolidation'),
    createSyllabusItem('BGF20', 'General Flying Proficiency Test'),
    createSyllabusItem('BIF MB1', 'Basic Instrument Flying'),
    createSyllabusItem('BIF MB2', 'IF UA Recoveries; IF Orientation'),
    createSyllabusItem('BIF TUT1', 'Instrument Flying Basics; Radial Intercepts & Tracking'),
    createSyllabusItem('BIF CPT1', 'Instrument Flying Basics'),
    createSyllabusItem('BIF CPT2', 'Radial Intercept and Tracking'),
    createSyllabusItem('BIF FTD1', 'IF Take-off; S&L, Climbing, Turning and Descending; Steep Turn; Radar Vectors to Initial'),
    createSyllabusItem('BIF FTD2', 'Radial Intercept and Tracking; A Recovery'),
    createSyllabusItem('BIF FTD3', 'Basic IF Consolidation'),
    createSyllabusItem('BIF1', 'IF Take-off; S&; Climbing, Turning and Descending; Steep Turn; UA Recovery; Radar Vectors to Straight In Approach'),
    createSyllabusItem('BIF2', 'IF Consol; Radial Intercept and Tracking; RNP Demo'),
    createSyllabusItem('BNF MB1', 'Night Flying'),
    createSyllabusItem('BNF FTD1', 'Night Circuits'),
    createSyllabusItem('BNF1', 'Night Circuits'),
    createSyllabusItem('BNF2', 'Night Circuits'),
    createSyllabusItem('BNF3', 'Night Solo Check'),
    createSyllabusItem('BNF4', 'Night Solo'),
    createSyllabusItem('BIF MB3', 'Instrument Approaches'),
    createSyllabusItem('BIF MB4', 'Holding'),
    createSyllabusItem('BIF MB5', 'RNP Approach'),
    createSyllabusItem('BIF TUT2', 'RNP Approach; Missed & Circling Approach'),
    createSyllabusItem('BIF CPT3', 'RNP Approach'),
    createSyllabusItem('BIF FTD4', 'RNP Approach; Circling Approach'),
    createSyllabusItem('BIF FTD5', 'RNP Approach; Missed Approach'),
    createSyllabusItem('BIF FTD6', 'RNP Approach HUD Off'),
    createSyllabusItem('BIF3', 'RNP Approach; Circling Approach; Missed Approach'),
    createSyllabusItem('BIF4', 'IF Consol; RNP Approach - HUD Off'),
    createSyllabusItem('BIF5', 'Instrument Flying Proficiency Test'),
    createSyllabusItem('BGF MB17', 'Advanced GF'),
    createSyllabusItem('BGF FTD10', 'GF Consol; Intermediate Emergency Handling; Unfamiliar Airfield'),
    createSyllabusItem('BGF21', 'GF Consolidation; Barrel Roll; L MFD Fail'),
    createSyllabusItem('BGF22', 'GF Consolidation; Stall Turn'),
    createSyllabusItem('BGF23', 'GF Consolidation'),
    createSyllabusItem('BGF24', 'General Flying Test'),
    createSyllabusItem('BNAV MB1', 'Medium Level Nav'),
    createSyllabusItem('BNAV TUT1', 'Nav Planning Tutorial'),
    createSyllabusItem('BNAV FTD1', 'Medium Level Navigation'),
    createSyllabusItem('BNAV1', 'Medium Level Navigation (Land Away)'),
    createSyllabusItem('BNAV2', 'Medium Level Navigation (RTB)'),
    createSyllabusItem('BNAV3 NAVPT', 'Navigation Proficiency Test'),
    createSyllabusItem('SCT GF', 'Sector General Flying'),
    createSyllabusItem('SCT IF', 'Sector Instrument Flying'),
    createSyllabusItem('SCT NAV', 'Sector Navigation'),
    createSyllabusItem('SCT FORM', 'Sector Formation'),
    createSyllabusItem('Night SCT', 'Night Sector Training'),

    // =========================================================================
    // FIC SYLLABUS - MASTER LMP (Full Rebuild)
    // Phase 1 / Module 1: FIC Core Events (MB, FTD, Flying)
    // Phase 1 / Module 2: FIC Instrument Flying Events
    // Phase 2 / Module 3: AIT Events
    // =========================================================================

    // --- Phase 1 / Module 1: FIC Core Events ---
    {
        id: 'FIC MB1',
        code: 'FIC MB1',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Introduction to military flight instruction. Covers instructional theory, adult learning principles, lesson planning frameworks, and the standards required of a qualified flying instructor (QFI). Trainee will understand the role and responsibilities of an instructor on the PC-21.',
        prerequisites: [],
        prerequisitesGround: [],
        prerequisitesFlying: [],
        eventDetailsCommon: [
            'Role of the Flying Instructor',
            'Adult Learning Principles and Motivation',
            'Lesson Planning and Sequencing',
            'Standards and Assessment Framework',
            'QFI Responsibilities and Duties',
        ],
        eventDetailsSortie: [],
        totalEventHours: 2.0,
        flightOrSimHours: 0,
        duration: 2.0,
        preFlightTime: 0,
        postFlightTime: 0,
        type: 'Ground School',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Classroom', 'Brief'],
        methodOfAssessment: ['Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['Classroom'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Classrooms',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC MB2',
        code: 'FIC MB2',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Detailed study of instructional patter, two-crew communication standards, and right-hand seat operating procedures. Covers demonstration-performance technique, handling over/taking control, and common student error management. Trainee will be able to plan and deliver basic patter sequences prior to simulator entry.',
        prerequisites: ['FIC MB1'],
        prerequisitesGround: ['FIC MB1'],
        prerequisitesFlying: [],
        eventDetailsCommon: [
            'Instructional Patter Structure and Delivery',
            'Two-Crew Communication and Crew Resource Management',
            'Right-Hand Seat Operating Procedures',
            'Demonstration-Performance Technique',
            'Handing Over and Taking Control Procedures',
            'Identifying and Correcting Common Student Errors',
        ],
        eventDetailsSortie: [],
        totalEventHours: 2.0,
        flightOrSimHours: 0,
        duration: 2.0,
        preFlightTime: 0,
        postFlightTime: 0,
        type: 'Ground School',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Classroom', 'Brief'],
        methodOfAssessment: ['Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['Classroom'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Classrooms',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC FTD1',
        code: 'FIC FTD1',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'First simulator instructional sortie. Trainee practices right-hand seat familiarisation, cockpit management, and delivery of circuit patter. Emphasis on patter accuracy, aircraft control from the right seat, and initial instructional technique. Conducted under close QFI supervision.',
        prerequisites: ['FIC MB2'],
        prerequisitesGround: ['FIC MB2'],
        prerequisitesFlying: [],
        eventDetailsCommon: [
            'Right-Hand Seat Cockpit Familiarisation',
            'Pre-flight and Startup Patter Delivery',
            'Normal Circuit Patter – Downwind, Base, Final',
            'Instructor Intervention Techniques',
            'Post-sortie Debrief and Self-assessment',
        ],
        eventDetailsSortie: [
            'Demonstrate startup, taxi and take-off patter',
            'Conduct minimum two circuit patter sequences',
            'Practice handing over and taking control',
        ],
        totalEventHours: 2.5,
        flightOrSimHours: 2.0,
        duration: 2.0,
        preFlightTime: 0.67,
        postFlightTime: 0.5,
        type: 'FTD',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['FTD', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 FTD'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'FTD Complex',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC FTD2',
        code: 'FIC FTD2',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Simulator patter development for general handling. Trainee delivers instructional patter for climbing, descending, level turns, and basic manoeuvring exercises. Focus on smooth patter flow, accurate sequencing, and maintaining aircraft control while instructing.',
        prerequisites: ['FIC FTD1'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC FTD1'],
        eventDetailsCommon: [
            'Patter for Climbing and Descending',
            'Level Turn Instruction Patter',
            'General Handling Sequence Delivery',
            'Tempo and Clarity of Instruction',
            'Managing Trainee Errors in General Handling',
        ],
        eventDetailsSortie: [
            'Deliver complete general handling instructional sequence',
            'Demonstrate recovery from student-induced deviations',
            'Practice controlled patter interruption and reinstatement',
        ],
        totalEventHours: 2.5,
        flightOrSimHours: 2.0,
        duration: 2.0,
        preFlightTime: 0.67,
        postFlightTime: 0.5,
        type: 'FTD',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['FTD', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 FTD'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'FTD Complex',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC1',
        code: 'FIC1',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'First airborne instructional sortie. Trainee flies from the right-hand seat and familiarises with airborne cockpit environment, power management, and basic aircraft handling. QFI demonstrates instructional technique for general handling and the trainee attempts initial patter delivery.',
        prerequisites: ['FIC FTD2'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC FTD2'],
        eventDetailsCommon: [
            'Right-Hand Seat Airborne Familiarisation',
            'Power Management and Basic Aircraft Control',
            'Situational Awareness from Right Seat',
            'Initial Patter Delivery Attempt',
            'QFI Demonstration of Instructional Technique',
        ],
        eventDetailsSortie: [
            'Conduct general handling sequence under QFI supervision',
            'Deliver patter for at least two exercise areas',
            'Demonstrate take-off and recovery patter',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC2',
        code: 'FIC2',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Instructional sortie focusing on teaching circuit patterns and take-off and landing sequences. Trainee delivers complete circuit patter including downwind checks, base turn, approach, and go-around procedures. QFI assesses patter accuracy, aircraft control, and error management.',
        prerequisites: ['FIC1'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC1'],
        eventDetailsCommon: [
            'Circuit Patter Delivery – Full Sequence',
            'Downwind Checks and Spacing Instruction',
            'Base Turn and Final Approach Patter',
            'Go-Around and Missed Approach Instruction',
            'Landing and Roll-out Instruction',
        ],
        eventDetailsSortie: [
            'Deliver minimum three complete circuit patter sequences',
            'Demonstrate go-around decision and patter',
            'Manage student deviation during final approach',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC3',
        code: 'FIC3',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Advanced general handling instructional sortie. Trainee teaches stall recognition and recovery, steep turns, and unusual attitude recovery. Focus on delivering clear, progressive instruction, managing safety of flight during student exercises, and adapting patter to student performance.',
        prerequisites: ['FIC2'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC2'],
        eventDetailsCommon: [
            'Stall Recognition and Recovery Patter',
            'Steep Turn Instructional Sequence',
            'Unusual Attitude Recovery Instruction',
            'Adapting Instruction to Student Level',
            'Safety of Flight Management While Instructing',
        ],
        eventDetailsSortie: [
            'Deliver stall series instruction for clean and landing configuration',
            'Conduct steep turn exercise with student',
            'Demonstrate unusual attitude recovery teaching sequence',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC FTD3',
        code: 'FIC FTD3',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Simulator patter development for emergency procedures instruction. Trainee practices teaching engine malfunctions, forced landing sequences, and emergency drills. Emphasis on maintaining patter composure during high-workload emergency scenarios.',
        prerequisites: ['FIC3'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC3'],
        eventDetailsCommon: [
            'Engine Failure and Forced Landing Instruction Patter',
            'Emergency Drill Teaching Sequence',
            'Maintaining Patter Composure Under Pressure',
            'Prioritisation – Aviate, Navigate, Communicate, Instruct',
            'Student Management During Emergency Scenarios',
        ],
        eventDetailsSortie: [
            'Demonstrate engine failure at altitude patter sequence',
            'Conduct simulated forced landing approach instruction',
            'Deliver emergency drill patter for two separate emergency types',
        ],
        totalEventHours: 2.5,
        flightOrSimHours: 2.0,
        duration: 2.0,
        preFlightTime: 0.67,
        postFlightTime: 0.5,
        type: 'FTD',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['FTD', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 FTD'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'FTD Complex',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC4',
        code: 'FIC4',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Instructional sortie covering aerobatic instruction technique. Trainee delivers instructional patter for wingovers, barrel rolls, and aerobatic entry/exit sequences. QFI assesses trainee ability to maintain positive aircraft control, deliver accurate patter, and manage student situational awareness during dynamic manoeuvres.',
        prerequisites: ['FIC FTD3'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC FTD3'],
        eventDetailsCommon: [
            'Aerobatic Instruction Safety Brief',
            'Wingover Instructional Patter',
            'Barrel Roll Teaching Sequence',
            'Aerobatic Entry and Exit Patter',
            'G-awareness Instruction and Management',
        ],
        eventDetailsSortie: [
            'Deliver complete wingover instructional sequence',
            'Conduct barrel roll instruction with student follow-through',
            'Demonstrate recovery from mishandled aerobatic entry',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC5',
        code: 'FIC5',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Advanced instructional sortie integrating multiple exercise areas. Trainee plans and executes a complete instructional sortie profile covering general handling, circuit, and selected emergency procedures. Assessed on lesson continuity, student management, and overall instructional quality.',
        prerequisites: ['FIC4'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC4'],
        eventDetailsCommon: [
            'Integrated Sortie Planning and Briefing',
            'Multi-exercise Instructional Delivery',
            'Lesson Continuity and Transitions Between Exercises',
            'In-flight Student Progress Assessment',
            'Comprehensive Post-sortie Debrief Technique',
        ],
        eventDetailsSortie: [
            'Execute planned instructional sortie with minimum three exercise areas',
            'Conduct at least one emergency exercise with student',
            'Deliver structured debrief covering all exercises',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC6',
        code: 'FIC6',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'FIC core flying phase consolidation sortie. Trainee demonstrates the ability to plan, brief, execute, and debrief a complete instructional sortie to the standard required of a qualified instructor. This is the final assessment of core instructional flying competency before IF phase entry.',
        prerequisites: ['FIC5'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC5'],
        eventDetailsCommon: [
            'Full Instructional Sortie to QFI Standard',
            'Comprehensive Pre-flight Brief',
            'General Handling, Circuits and Emergency Instruction',
            'Instructor-Standard Aircraft Control and Airmanship',
            'Structured Post-sortie Debrief to Standard',
        ],
        eventDetailsSortie: [
            'Plan and brief a complete instructional sortie profile',
            'Execute sortie to QFI standard covering all required exercise areas',
            'Conduct assessed debrief demonstrating lesson analysis skills',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC FTD4',
        code: 'FIC FTD4',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Simulator consolidation for advanced handling instruction. Covers patter development for spin recovery, advanced stalls, and high-energy manoeuvre instruction. Trainee demonstrates the ability to manage complex student scenarios, deliver accurate recovery patter, and maintain instructional composure.',
        prerequisites: ['FIC6'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC6'],
        eventDetailsCommon: [
            'Spin Recognition and Recovery Instruction Patter',
            'Advanced Stall Series Teaching Technique',
            'High-energy Manoeuvre Instruction',
            'Composure Management During Critical Exercises',
            'Debrief Technique for Complex Sorties',
        ],
        eventDetailsSortie: [
            'Deliver spin recovery instructional sequence from both seats',
            'Conduct advanced stall instruction including accelerated stalls',
            'Demonstrate management of student near-departure from controlled flight',
        ],
        totalEventHours: 2.5,
        flightOrSimHours: 2.0,
        duration: 2.0,
        preFlightTime: 0.67,
        postFlightTime: 0.5,
        type: 'FTD',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['FTD', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 FTD'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'FTD Complex',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC FTD5',
        code: 'FIC FTD5',
        phase: 'Phase 1',
        module: 'Module 1: FIC Events',
        dayNight: 'Day',
        eventDescription: 'Simulator-based preparation for instrument flying instruction. Trainee practices instructing under-the-hood procedures, recovery from unusual attitudes under instruments, and transition between visual and instrument flight phases. Preparation for the IF instruction phase.',
        prerequisites: ['FIC FTD4'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC FTD4'],
        eventDetailsCommon: [
            'Instrument Flying Instructional Overview',
            'Under-the-hood Procedures and Teaching Technique',
            'Unusual Attitude Recovery Instruction – Instruments',
            'Transition Between Visual and Instrument Phases',
            'IF Sortie Planning and Briefing Preparation',
        ],
        eventDetailsSortie: [
            'Deliver instrument flying instructional patter for basic IF manoeuvres',
            'Conduct unusual attitude recovery instruction on instruments',
            'Demonstrate transition brief from visual to instrument flight',
        ],
        totalEventHours: 2.5,
        flightOrSimHours: 2.0,
        duration: 2.0,
        preFlightTime: 0.67,
        postFlightTime: 0.5,
        type: 'FTD',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['FTD', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 FTD'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'FTD Complex',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },

    // --- Phase 1 / Module 2: FIC Instrument Flying Events ---
    {
        id: 'FIC IF1',
        code: 'FIC IF1',
        phase: 'Phase 1',
        module: 'Module 2: FIC IF Events',
        dayNight: 'Day',
        eventDescription: 'First instrument flying instructional sortie. Trainee delivers airborne instruction for basic instrument flying — straight and level, climbing, descending, and turning under instruments. QFI assesses quality of patter delivery, management of student under the hood, and maintenance of safe IFR standards.',
        prerequisites: ['FIC FTD5'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC FTD5'],
        eventDetailsCommon: [
            'Basic IF Instruction – Straight and Level, Climb, Descent',
            'Instrument Turning Instruction',
            'Managing a Student Under the Hood',
            'IF Situational Awareness Instruction',
            'IFR Communication and Clearance Instruction',
        ],
        eventDetailsSortie: [
            'Deliver instrument flying patter for all basic IF manoeuvres',
            'Manage student hood-down and spatial disorientation risk',
            'Demonstrate IFR communication instruction',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC IF2',
        code: 'FIC IF2',
        phase: 'Phase 1',
        module: 'Module 2: FIC IF Events',
        dayNight: 'Day',
        eventDescription: 'Instrument approach instruction sortie. Trainee teaches instrument approach procedures including VOR/NDB/RNP approach sequences, missed approach procedures, and approach briefing technique. Focus on managing student workload during high-concentration approach phases.',
        prerequisites: ['FIC IF1'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC IF1'],
        eventDetailsCommon: [
            'Instrument Approach Instructional Briefing',
            'RNP/GNSS Approach Patter Sequence',
            'Missed Approach Instruction and Go-around Patter',
            'Approach Plate Study and Student Guidance',
            'Managing Student Workload on Approach',
        ],
        eventDetailsSortie: [
            'Deliver complete instrument approach instructional sequence',
            'Conduct missed approach instruction with student',
            'Demonstrate approach plate briefing technique',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC IF3',
        code: 'FIC IF3',
        phase: 'Phase 1',
        module: 'Module 2: FIC IF Events',
        dayNight: 'Day',
        eventDescription: 'Advanced instrument flying instruction sortie. Covers teaching of holding procedures, radar vectoring response, and instrument-based navigation exercises. Trainee demonstrates the ability to instruct in a high-workload IFR environment while maintaining safety and instructional quality.',
        prerequisites: ['FIC IF2'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC IF2'],
        eventDetailsCommon: [
            'Holding Pattern Entry and Instruction',
            'Radar Vectors Instruction and Response',
            'Instrument Navigation Teaching Technique',
            'High-workload IFR Instruction Management',
            'ATC Interface Instruction During IF Sortie',
        ],
        eventDetailsSortie: [
            'Teach holding pattern entry and timing procedures',
            'Conduct radar vectoring instruction sequence',
            'Manage student IFR navigation with instructor oversight',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC IF4',
        code: 'FIC IF4',
        phase: 'Phase 1',
        module: 'Module 2: FIC IF Events',
        dayNight: 'Day',
        eventDescription: 'IF phase consolidation and final assessment sortie. Trainee plans and executes a complete IFR instructional flight to the standard required of a qualified IF instructor. Assessed on briefing quality, airborne instruction, student management, and post-sortie debrief.',
        prerequisites: ['FIC IF3'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC IF3'],
        eventDetailsCommon: [
            'Complete IFR Sortie Planning and Briefing',
            'Full Instrument Instructional Sequence',
            'In-flight Assessment of Student IF Progress',
            'Emergency Handling in IFR Environment',
            'Comprehensive IF Debrief and Lesson Analysis',
        ],
        eventDetailsSortie: [
            'Plan and execute a complete IFR instructional sortie',
            'Deliver IF instruction covering navigation, approaches, and holds',
            'Conduct assessed debrief to IF instructor standard',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'FIC FTD6',
        code: 'FIC FTD6',
        phase: 'Phase 1',
        module: 'Module 2: FIC IF Events',
        dayNight: 'Day',
        eventDescription: 'Simulator consolidation supporting the IF instructional phase. Covers advanced IF procedures instruction including partial panel flying, instrument failure recognition and management, and high-density IFR environment instruction. Provides a safe training environment for rehearsing complex IF teaching scenarios.',
        prerequisites: ['FIC IF4'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC IF4'],
        eventDetailsCommon: [
            'Partial Panel Flying Instruction',
            'Instrument Failure Recognition and Teaching',
            'High-density IFR Environment Simulation',
            'Complex IF Student Error Management',
            'Multi-approach IFR Sortie Instruction',
        ],
        eventDetailsSortie: [
            'Conduct partial panel instruction sequence in FTD',
            'Demonstrate instrument failure recognition teaching',
            'Deliver multi-approach IFR instructional profile',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 2.0,
        duration: 2.0,
        preFlightTime: 0.67,
        postFlightTime: 0.5,
        type: 'FTD',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['FTD', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 FTD'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'FTD Complex',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },

    // --- Phase 2 / Module 3: AIT Events ---
    {
        id: 'AIT1',
        code: 'AIT1',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'Advanced Instructor Training entry sortie. Trainee demonstrates consolidation of core QFI skills in preparation for advanced instruction qualification. Covers advanced general handling instruction, student management in complex scenarios, and assessment of trainee readiness to progress to advanced instructional tasks.',
        prerequisites: ['FIC FTD6'],
        prerequisitesGround: [],
        prerequisitesFlying: ['FIC FTD6'],
        eventDetailsCommon: [
            'Advanced Instructional Technique Review',
            'Complex Student Scenario Management',
            'Advanced General Handling Instruction',
            'Instructor Readiness Assessment for AIT',
            'AIT Programme Standards and Requirements Brief',
        ],
        eventDetailsSortie: [
            'Demonstrate advanced general handling instruction to AIT entry standard',
            'Conduct complex student scenario management exercise',
            'Receive AIT standards brief and confirm training objectives',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'AIT2',
        code: 'AIT2',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'Advanced instruction of navigation and tactical low-level flying. Trainee teaches navigation planning, map reading, low-level route-following, and tactical airspace awareness. Focus on managing student navigation errors, route deviations, and maintaining safety in low-level environment.',
        prerequisites: ['AIT1'],
        prerequisitesGround: [],
        prerequisitesFlying: ['AIT1'],
        eventDetailsCommon: [
            'Navigation Planning Instruction',
            'Map Reading and Route-following Teaching',
            'Low-level Route Instruction and Safety Management',
            'Tactical Airspace Awareness Instruction',
            'Managing Student Navigation Errors and Deviations',
        ],
        eventDetailsSortie: [
            'Teach navigation planning and pre-flight preparation',
            'Conduct low-level route instruction with student',
            'Manage student navigation error and demonstrate recovery instruction',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'AIT3',
        code: 'AIT3',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'Advanced formation flying instruction. Trainee teaches two-ship formation join-up, close formation station keeping, and lead/wingman responsibilities. Focus on delivering clear formation instruction, managing student geometry errors, and maintaining safe separation standards.',
        prerequisites: ['AIT2'],
        prerequisitesGround: [],
        prerequisitesFlying: ['AIT2'],
        eventDetailsCommon: [
            'Formation Join-up Instruction',
            'Close Formation Station Keeping Patter',
            'Lead and Wingman Responsibilities Instruction',
            'Formation Geometry Error Management',
            'Safe Separation Standards and Instruction',
        ],
        eventDetailsSortie: [
            'Teach two-ship formation join-up sequence',
            'Conduct close formation instruction with student as wingman',
            'Manage student geometry error and correct with instruction',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'AIT4',
        code: 'AIT4',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'Advanced instrument flying instruction under AIT standards. Trainee teaches advanced IFR procedures including non-precision approaches, circling approaches, and en-route navigation in IMC. QFI assesses ability to maintain instructional quality in complex IFR environment.',
        prerequisites: ['AIT3'],
        prerequisitesGround: [],
        prerequisitesFlying: ['AIT3'],
        eventDetailsCommon: [
            'Non-precision Approach Instruction – NDB/VOR',
            'Circling Approach Instruction and Safety Management',
            'En-route Navigation in IMC Instruction',
            'Advanced IFR Student Workload Management',
            'Adverse Weather Decision-making Instruction',
        ],
        eventDetailsSortie: [
            'Teach non-precision approach procedures to student',
            'Conduct circling approach instruction with appropriate safety brief',
            'Deliver en-route IMC navigation instruction sequence',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'AIT5',
        code: 'AIT5',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'Advanced tactical instruction and airspace deconfliction. Trainee teaches tactical area operations, airspace coordination, and mission planning instruction. Focus on instructing in a dynamic tactical environment while maintaining safety oversight and CRM standards.',
        prerequisites: ['AIT4'],
        prerequisitesGround: [],
        prerequisitesFlying: ['AIT4'],
        eventDetailsCommon: [
            'Tactical Area Operations Instruction',
            'Airspace Coordination and Deconfliction Teaching',
            'Mission Planning Instruction',
            'CRM in Tactical Environment',
            'Safety Oversight in Dynamic Tactical Instruction',
        ],
        eventDetailsSortie: [
            'Teach tactical area operations procedures and airspace management',
            'Conduct mission planning instruction with student',
            'Demonstrate CRM instruction in simulated tactical scenario',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'AIT6',
        code: 'AIT6',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'Advanced student management and remedial instruction. Trainee practices teaching techniques for managing underperforming students, delivering remedial instruction, documenting student progress, and making training progress recommendations. Focus on instructor decision-making and pastoral responsibility.',
        prerequisites: ['AIT5'],
        prerequisitesGround: [],
        prerequisitesFlying: ['AIT5'],
        eventDetailsCommon: [
            'Remedial Instruction Technique',
            'Underperforming Student Management',
            'Progress Documentation and Reporting',
            'Training Progress Recommendations',
            'Instructor Pastoral Responsibilities',
        ],
        eventDetailsSortie: [
            'Conduct remedial instruction exercise with simulated underperforming student',
            'Prepare and present a student progress report',
            'Demonstrate training recommendation decision-making process',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'AIT7',
        code: 'AIT7',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'AIT pre-final check and self-assessment sortie. Trainee conducts a self-assessed instructional sortie covering selected AIT exercise areas. Focus on independent preparation, execution, and self-critique. QFI observes and provides post-sortie assessment against AIT standards.',
        prerequisites: ['AIT6'],
        prerequisitesGround: [],
        prerequisitesFlying: ['AIT6'],
        eventDetailsCommon: [
            'Independent Sortie Planning and Briefing',
            'Self-assessed Instructional Performance',
            'AIT Standard Exercise Coverage',
            'Post-sortie Self-critique and Analysis',
            'QFI Assessment Against AIT Standards',
        ],
        eventDetailsSortie: [
            'Plan and execute independent instructional sortie to AIT standard',
            'Cover minimum three AIT exercise areas',
            'Deliver self-critique debrief prior to QFI assessment',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    {
        id: 'AIT8',
        code: 'AIT8',
        phase: 'Phase 2',
        module: 'Module 3: AIT Events',
        dayNight: 'Day',
        eventDescription: 'AIT final grading sortie. Trainee demonstrates complete Advanced Instructor Training competency across all required areas. This is the final assessment flight for the FIC course. Successful completion results in qualification as a Qualified Flying Instructor (QFI) on type.',
        prerequisites: ['AIT7'],
        prerequisitesGround: [],
        prerequisitesFlying: ['AIT7'],
        eventDetailsCommon: [
            'Full AIT Final Assessment Sortie',
            'Comprehensive Instructional Sequence Coverage',
            'Advanced Student Management in Final Assessment',
            'QFI Standard Aircraft Control and Airmanship',
            'Final Grading Debrief and Course Completion',
        ],
        eventDetailsSortie: [
            'Execute final AIT grading sortie covering all assessed areas',
            'Demonstrate QFI-standard instruction throughout sortie',
            'Receive final grading debrief and course completion assessment',
        ],
        totalEventHours: 3.0,
        flightOrSimHours: 1.2,
        duration: 1.2,
        preFlightTime: 1.25,
        postFlightTime: 0.5,
        type: 'Flight',
        sortieType: 'Dual',
        twrDiReqd: 'NO',
        cctOnly: 'NO',
        methodOfDelivery: ['Aircraft', 'Brief', 'Debrief'],
        methodOfAssessment: ['Practical Assessment', 'Instructor Observation', 'Structured Debrief'],
        resourcesPhysical: ['PC-21 Aircraft'],
        resourcesHuman: ['Qualified Flying Instructor', 'Trainee'],
        location: 'Airfield',
        courses: ['FIC'],
        lmpType: 'Master LMP',
    },
    
    // WSO Items
    createSyllabusItem('WSO MB1', 'Role of the WSO', ['WSO']),
    createSyllabusItem('WSO FTD1', 'Sensor Operations Basics', ['WSO']),
    createSyllabusItem('WSO1', 'Navigational Systems Management', ['WSO']),
    
    // OFI Items
    createSyllabusItem('OFI MB1', 'Advanced Operational Concepts', ['OFI']),
    createSyllabusItem('OFI1', 'Tactical Formation Lead', ['OFI']),
    
    // PLT Refresh Items
    createSyllabusItem('PLT REF MB1', 'Refresher Admin Brief', ['PLT Refresh', 'PLT CONV']),
    createSyllabusItem('PLT REF FTD1', 'Emergency Procedures Refresh', ['PLT Refresh']),
    createSyllabusItem('PLT REF1', 'General Handling Recency', ['PLT Refresh']),
    
    // QFI CONV
    createSyllabusItem('QFI CONV MB1', 'QFI Conversion Requirements', ['QFI CONV']),
    createSyllabusItem('QFI CONV1', 'Instructional Technique - Advanced', ['QFI CONV']),

    // Staff CAT (Staff Continuous Training Categorisation)
    createSyllabusItem('QIP 1', 'QFI Induction Program 1', ['Staff CAT']),
    createSyllabusItem('QIP 2', 'QFI Induction Program 2', ['Staff CAT']),
    createSyllabusItem('QIP 3', 'QFI Induction Program 3', ['Staff CAT']),
    createSyllabusItem('QIP 4', 'QFI Induction Program 4', ['Staff CAT']),
    createSyllabusItem('C CAT 1', 'C Categorisation 1', ['Staff CAT']),
    createSyllabusItem('C CAT 2', 'C Categorisation 2', ['Staff CAT']),
    createSyllabusItem('C CAT 3', 'C Categorisation 3', ['Staff CAT']),
    createSyllabusItem('C CAT 4', 'C Categorisation 4', ['Staff CAT']),
    createSyllabusItem('B CAT 1', 'B Categorisation 1', ['Staff CAT']),
    createSyllabusItem('B CAT 2', 'B Categorisation 2', ['Staff CAT']),
    createSyllabusItem('B CAT 3', 'B Categorisation 3', ['Staff CAT']),
    createSyllabusItem('B CAT 4', 'B Categorisation 4', ['Staff CAT']),
];

const populatePrerequisites = (syllabus: SyllabusItemDetail[]): SyllabusItemDetail[] => {
    return syllabus.map((item, index, arr) => {
        // If this item already has explicitly set prerequisites, preserve them
        const hasExplicitPrereqs = (item.prerequisites && item.prerequisites.length > 0) ||
            (item.prerequisitesGround && item.prerequisitesGround.length > 0) ||
            (item.prerequisitesFlying && item.prerequisitesFlying.length > 0);
        
        // For FIC/AIT items that have lmpType set, always use their explicit prerequisites
        if (hasExplicitPrereqs || item.lmpType === 'Master LMP') {
            return item;
        }

        const prerequisitesGround: string[] = [];
        const prerequisitesFlying: string[] = [];
        
        // Find the immediate previous non-MB event within the SAME course(s)
        // This ensures FIC, WSO, OFI etc. don't inherit BGF prerequisites
        for (let i = index - 1; i >= 0; i--) {
            const prereqCandidate = arr[i];
            
            // Skip MB items (mass briefs are not prerequisites)
            if (prereqCandidate.code.includes(' MB')) continue;
            
            // CRITICAL: Only use as prerequisite if the candidate shares at least one course with the current item
            const sharedCourses = prereqCandidate.courses.some(c => item.courses.includes(c));
            if (!sharedCourses) break; // Stop looking - we've crossed a course boundary
            
            if (prereqCandidate.type === 'Flight' || prereqCandidate.type === 'FTD') {
                prerequisitesFlying.push(prereqCandidate.code);
            } else {
                prerequisitesGround.push(prereqCandidate.code);
            }
            break; 
        }
        return { ...item, prerequisitesGround, prerequisitesFlying, prerequisites: [...prerequisitesGround, ...prerequisitesFlying] };
    });
};

export const INITIAL_SYLLABUS_DETAILS: SyllabusItemDetail[] = populatePrerequisites(syllabusItems);

export const DEFAULT_PHRASE_BANK: PhraseBank = {
    'Airmanship': {
        5: [
            'Operates the aircraft safely and effectively at all times.',
            'Organised and deals with all situations effectively, under all workloads.',
            'Handles non-standard situations capably with a high level of confidence.',
            'Excellent decision making based on situational awareness and prioritised attention.'
        ],
        4: [
            'Operates the aircraft safely and effectively.',
            'Handles most normal situations well.',
            'Needs occasional help with non-standard routines but does not become confused under moderate workloads.',
            'Very good decision making based on situational awareness and prioritised attention.',
            'Sometimes overlooks some considerations but not to the detriment of safety.'
        ],
        3: [
            'Operates the aircraft safely.',
            'Copes with normal situations.',
            'Occasionally slow to react to new or developing situations.',
            'Makes basic decisions and applies the basic considerations.',
            'Adequate confidence and decision making ability.'
        ],
        2: [
            'Operates the aircraft safely in familiar situations.',
            'Slow to react to new or developing situations.',
            'Makes basic decisions in familiar situations.',
            'Sometimes unsure in new or more advanced sequences.',
            'Developing confidence and decision making ability.'
        ],
        1: [
            'Just coping with familiar situations.',
            'Had difficulty applying normal procedures.',
            'Often deviated from more complex or advanced routines.',
            'Showed a lack of situational awareness.',
            'Made basic decisions but was sometimes overwhelmed or task saturated by basic sequences.',
            'Not confident.',
            'Uncharacteristic major safety breach.'
        ],
        0: [
            'Poor.',
            'Frequently deviated from normal procedures.',
            'Not able to cope with familiar situations.',
            'Demonstrated likelihood of violating aircraft and operational limits.',
            'Frequently task-saturated by basic sequences.',
            'Easily confused and often disorganised.',
            'Excessively under or over confident.',
            'Repeated safety breaches.'
        ]
    },
    'Preparation': {
        5: [
            'Always fully prepared.',
            'An excellent understanding of sortie requirements.',
            'Focussed and committed to continuous improvement.',
            'Prepared technique and sequences to a very high standard.',
            'Enthusiastic and motivated to achieve excellence.'
        ],
        4: [
            'Well prepared.',
            'Researched widely to develop a sound understanding of all sortie aspects.',
            'Focussed and committed to improvement.',
            'Prepared technique and sequences to a high standard.',
            'Enthusiastic and motivated.'
        ],
        3: [
            'Adequate understanding of the sortie objectives.',
            'Some gaps in wider knowledge but not to the detriment of the sortie.',
            'Made good progress.'
        ],
        2: [
            'Just adequate understanding of sortie requirements.',
            'Gaps in knowledge from previous instruction, to the detriment of the sortie.',
            'Made some progress.'
        ],
        1: [
            'Preparation barely adequate.',
            'Tried to prepare but had difficulty in discerning the essential aspects of the lessons or sortie objectives.',
            'Little evidence of desire to succeed.',
            'Major deficiencies in knowledge from previous instruction.',
            'Repetitive instruction was necessary to achieve the sortie aims.'
        ],
        0: [
            'Didn’t prepare basic sortie points.',
            'No evidence of further research.',
            'Ineffectual.',
            'Did not use appropriate methods to address poor performance.',
            'Not sufficiently conversant with basics.',
            'Lacked drive and zeal.',
            'No evidence of desire to succeed.',
            'No evidence of any preparation of previously learnt sequences.'
        ]
    },
    'Technique': {
        5: [
            'Smooth, positive and coordinated.',
            'Accurately trimmed.',
            'Correct technique used at all times.',
            'Errors and minor lapses rarely encountered, but rectified promptly.',
            'Very good level of accuracy, no prompts necessary.',
            'Always prioritised work cycles.'
        ],
        4: [
            'Positive and coordinated.',
            'Technique applied correctly and to a very high standard.',
            'Errors recognised and corrected promptly.',
            'Strived for good accuracy.',
            'Consistent use of attitudes to correct.',
            'Good work cycles.'
        ],
        3: [
            'Usually positive and coordinated.',
            'Applied the basics in a smooth coordinated manner.',
            'Minor lapses detracted from the overall finesse.',
            'Errors recognised and corrected.',
            'Acceptable accuracy with only minor prompts.',
            'Usually employed attitudes to correct.',
            'Effective cycles.'
        ],
        2: [
            'Normally applied the basic techniques.',
            'Sometimes abrupt and slow but usually coordinated.',
            'Errors corrected appropriately.',
            'Acceptable accuracy but some prompting still required.',
            'Generally employed attitudes to correct.',
            'Developing work cycles.'
        ],
        1: [
            'Had difficulty applying the basic techniques.',
            'Responded to instruction, however poor retention.',
            'Slow to act when errors occur.',
            'Developing accuracy but frequent prompting required.',
            'Sometimes weak attitude skills.',
            'Sometimes work cycles were organised.'
        ],
        0: [
            'Uncoordinated, abrupt and slow.',
            'Seldom trimmed.',
            'Frequently employed incorrect technique.',
            'Unable to recognise errors.',
            'Unacceptable accuracy despite frequent prompts.',
            'Very weak attitude skills, lapses to performance flying.',
            'Disorganised work cycles.',
            'Could not reproduce previously learnt airborne sequences.'
        ]
    },
    'Generic Flying Elements': {
        5: [
            'Smooth, positive and well-coordinated throughout.',
            'Demonstrates strong situational awareness.',
            'Maintains effective work cycles and prioritises tasks effectively.',
            'Applies technique with confidence and precision, requiring no prompts.',
            'Easily adapts to changing conditions and workload.',
            'Shows consistently good scan technique and accurate control inputs.'
        ],
        4: [
            'Positive control and well-applied basic technique.',
            'Good accuracy with only occasional minor lapses.',
            'Demonstrates effective scan and work cycles most of the time.',
            'Recognises and corrects errors promptly.',
            'Manages workload well and maintains situational awareness.'
        ],
        3: [
            'Generally smooth and coordinated with acceptable technique.',
            'Minor lapses evident but do not affect overall safety.',
            'Adequate scan technique with some prompting required.',
            'Responds appropriately to instruction and corrects most errors.',
            'Maintains situational awareness in familiar situations.'
        ],
        2: [
            'Basic technique applied but inconsistently.',
            'Sometimes abrupt or slow to act, requiring moderate prompting.',
            'Scan technique developing; occasionally fixates.',
            'Work cycles are present but not always effective.',
            'Situational awareness varies, especially under higher workload.'
        ],
        1: [
            'Difficulty applying basic technique without frequent assistance.',
            'Ineffective work cycles; task saturation common.',
            'Slow recognition of errors; corrections often delayed.',
            'Poor scan discipline with frequent lapses.',
            'Limited situational awareness; struggles beyond familiar patterns.'
        ],
        0: [
            'Uncoordinated and lacking basic control technique.',
            'Unable to maintain situational awareness even in simple tasks.',
            'Frequent errors with little or no self-correction.',
            'Work cycles disorganised or absent.',
            'Easily overwhelmed; demonstrates unsafe or inconsistent behaviour.'
        ]
    }
};

// --- Name Generation Helpers ---
const firstNames = ['Olivia', 'Emma', 'Amelia', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Luna', 'Harper', 'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Henry', 'Lucas', 'Benjamin', 'Theodore', 'Emily', 'Michael', 'Jessica', 'David', 'Sarah', 'Chris', 'Daniel', 'Matthew', 'Ashley', 'Jennifer', 'Robert', 'John', 'Linda', 'Barbara', 'Susan', 'Mary', 'Patricia', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Steven', 'Paul', 'Mark'];
const lastNames = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Johnson', 'Walker', 'Robinson', 'Thompson', 'White', 'Green', 'Harris', 'Clark', 'Lewis', 'Hall', 'Baker', 'Martin', 'Jackson', 'Wood', 'Turner', 'Hill', 'Moore', 'Scott', 'Cooper', 'King', 'Wright', 'Lee', 'Mitchell', 'Anderson', 'Carter', 'Parker', 'Edwards', 'Stewart', 'Morris'];
const usedNames = new Set<string>();

const generateRandomName = (): string => {
  let name = '';
  do {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    name = `${lastName}, ${firstName}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
};

const flightOptions = ['A', 'B', 'C', 'D'];
const getRandomFlight = () => flightOptions[Math.floor(Math.random() * flightOptions.length)];

// Helper for unique IDs
const usedIdNumbers = new Set<number>();
const generateRandomIdNumber = (): number => {
  let id: number;
  do {
    id = Math.floor(Math.random() * (9999999 - 1000000 + 1)) + 1000000;
  } while (usedIdNumbers.has(id));
  usedIdNumbers.add(id);
  return id;
};

const generateTraineesForCourse = (courseName: string, rankDistribution: { rank: TraineeRank; count: number }[], unit: '1FTS' | 'CFS' | '2FTS'): Trainee[] => {
  const location = (unit === '2FTS') ? 'Pearce' : 'East Sale';
  const trainees: Trainee[] = [];
  rankDistribution.forEach(({ rank, count: numToGenerate }) => {
    for (let i = 0; i < numToGenerate; i++) {
      const name = generateRandomName();
      let service: 'RAAF' | 'RAN' | 'ARA' = 'RAAF';
      if(rank === 'MIDN' || rank === 'SBLT') service = 'RAN';
      if(rank === '2LT') service = 'ARA';
      const phoneNumber = `04${Math.floor(10000000 + Math.random() * 90000000)}`.substring(0, 10);
      const nameParts = name.split(', ');
      const email = `${nameParts[1]}.${nameParts[0]}@flightschool.mil`.toLowerCase();
      
      const traineeCallsign = `CHLE${Math.floor(Math.random() * 101) + 300}`;
      trainees.push({
        idNumber: generateRandomIdNumber(),
        fullName: `${name} – ${courseName}`,
        name: name,
        rank: rank,
        course: courseName,
        seatConfig: 'Normal',
        isPaused: Math.random() < 0.05, // 5% chance of being paused
        unit: unit,
        flight: getRandomFlight(),
        service: service,
        location,
        phoneNumber,
        email,
        unavailability: [],
           traineeCallsign,
        permissions: ['Trainee'],
        // lastEventDate and lastFlightDate will be populated by the scoring simulation
      });
    }
  });
  return trainees.sort(() => Math.random() - 0.5);
};

// --- Instructor Generation Helper ---
const generateInstructors = (targetLocation: 'ESL' | 'PEA'): Instructor[] => {
    const qfis: Instructor[] = [];
    const simIps: Instructor[] = [];
    let qfiCallsignCounter = 10;
    const categories: InstructorCategory[] = ['UnCat', 'D', 'C', 'B', 'A'];

    const isESL = targetLocation === 'ESL';

    // --- Generate Executives (WGCDR, SQNLDR) ---
    // ESL: 4 for 1FTS, 2 for CFS | PEA: 6 for 2FTS
    const num1FTSExecutives = isESL ? 4 : 0;
    const executiveRanks: InstructorRank[] = ['WGCDR', ...Array(5).fill('SQNLDR')];
    
    for (let i = 0; i < executiveRanks.length; i++) {
        const rank = executiveRanks[i];
        let service: 'RAAF' | 'RAN' | 'ARA' = 'RAAF';
        const randService = Math.random();
        if (randService > 0.95) service = 'ARA';
        else if (randService > 0.9) service = 'RAN';
        const name = generateRandomName();
        const nameParts = name.split(', ');
        const email = `${nameParts[1]}.${nameParts[0]}@flightschool.mil`.toLowerCase().replace(/\s/g, '');
        
        const isCommandingOfficer = rank === 'WGCDR';
        const isCFI = !isCommandingOfficer && Math.random() < 0.2;

        qfis.push({
            idNumber: generateRandomIdNumber(),
            name: name,
            rank: rank,
            role: 'QFI',
            callsignNumber: qfiCallsignCounter++,
            service,
            category: 'A',
            isTestingOfficer: true,
            isQFI: true,
            isOFI: false,
            seatConfig: 'Normal',
            isExecutive: true,
            isFlyingSupervisor: true,
            isIRE: Math.random() < 0.2,
            isCommandingOfficer,
            isCFI,
            location: isESL ? 'East Sale' : 'Pearce',
            unit: isESL ? (i < num1FTSExecutives ? '1FTS' : 'CFS') : '2FTS',
            unavailability: [],
            email,
            permissions: ['Staff', 'Course Supervisor', 'Admin'],
            flight: (isCommandingOfficer || isCFI) ? 'EXEC' : getRandomFlight(),
        });
    }
    
    // --- Generate FLTLTs ---
    // ESL: 34 for 1FTS + 15 for CFS = 49 FLTLTs
    // Total ESL: 4 exec (1FTS) + 34 FLTLT (1FTS) = 38 for 1FTS ✓
    //            2 exec (CFS) + 15 FLTLT (CFS) + 1 Joe Bloggs (CFS) = 18 for CFS ✓
    // PEA: 31 for 2FTS
    const num1FTSFltlts = isESL ? 34 : 0;
    const numCFSFltlts = isESL ? 15 : 0;
    const num2FTSFltlts = isESL ? 0 : 31;
    const numFltlts = num1FTSFltlts + numCFSFltlts + num2FTSFltlts;
    
    for (let i = 0; i < numFltlts; i++) {
        let service: 'RAAF' | 'RAN' | 'ARA' = 'RAAF';
        const phoneNumber = `04${Math.floor(10000000 + Math.random() * 90000000)}`.substring(0, 10);
        const name = generateRandomName();
        const nameParts = name.split(', ');
        const email = `${nameParts[1]}.${nameParts[0]}@flightschool.mil`.toLowerCase().replace(/\s/g, '');

        const randService = Math.random();
        if (randService > 0.95) service = 'ARA';
        else if (randService > 0.9) service = 'RAN';
        
        const isExecutive = Math.random() < 0.1;

        qfis.push({
            idNumber: generateRandomIdNumber(),
            name: name,
            rank: 'FLTLT',
            role: 'QFI',
            callsignNumber: qfiCallsignCounter++,
            service,
            category: categories[Math.floor(Math.random() * categories.length)],
            seatConfig: 'Normal',
            isExecutive,
            isFlyingSupervisor: false,
            isTestingOfficer: false,
            isQFI: true,
            isOFI: false,
            isIRE: isExecutive && Math.random() < 0.2,
            location: isESL ? 'East Sale' : 'Pearce',
            unit: isESL ? (i < num1FTSFltlts ? '1FTS' : 'CFS') : '2FTS',
            flight: getRandomFlight(),
            phoneNumber,
            email,
            unavailability: [],
            permissions: ['Staff'],
        });
    }

    // --- Randomly assign supervisor and testing officer roles to FLTLTs ---
    const shuffledFltltIndices = Array.from(Array(numFltlts).keys()).sort(() => Math.random() - 0.5);
    const fltltSupervisorIndices = new Set(shuffledFltltIndices.slice(0, 5));
    
    const execOffset = 6;
    
    fltltSupervisorIndices.forEach((index) => {
        const fltlt = qfis[execOffset + index];
        if (fltlt) {
            fltlt.isFlyingSupervisor = true;
            fltlt.isTestingOfficer = Math.random() < 0.4;
             if (fltlt.isFlyingSupervisor) {
                fltlt.permissions?.push('Course Supervisor');
            }
        }
    });

    // --- ADD JOE BLOGGS (ESL ONLY) ---
    if (isESL) {
        const joeBloggs: Instructor = {
            idNumber: generateRandomIdNumber(),
            name: 'Bloggs, Joe',
            rank: 'FLTLT',
            role: 'QFI',
            callsignNumber: 99, 
            service: 'RAAF',
            category: 'A',
            isTestingOfficer: true,
            isQFI: true,
            isOFI: false,
            seatConfig: 'Normal',
            isExecutive: true,
            isFlyingSupervisor: true,
            isIRE: true,
            location: 'East Sale',
            unit: 'CFS',
            flight: 'A',
            phoneNumber: '0412345678',
            email: 'joe.bloggs@flightschool.mil',
            unavailability: [],
            permissions: ['Staff', 'Ops', 'Course Supervisor', 'Admin', 'Super Admin'],
        };
        usedNames.add('Bloggs, Joe'); 
        qfis.push(joeBloggs);
    }

    // Generate SIM IPs (4 for ESL, 4 for PEA)
    const numSimIps = 4;
    for (let i = 0; i < numSimIps; i++) {
        const phoneNumber = `04${Math.floor(10000000 + Math.random() * 90000000)}`.substring(0, 10);
        const name = generateRandomName();
        const nameParts = name.split(', ');
        const email = `${nameParts[1]}.${nameParts[0]}@flightschool.mil`.toLowerCase().replace(/\s/g, '');

        simIps.push({
            idNumber: generateRandomIdNumber(),
            name: name,
            rank: 'Mr',
            role: 'SIM IP',
            callsignNumber: 0,
            service: undefined,
            category: 'UnCat',
            isTestingOfficer: false,
            isQFI: false,
            isOFI: false,
            seatConfig: 'Normal',
            isExecutive: false,
            isFlyingSupervisor: false,
            isIRE: false,
            location: isESL ? 'East Sale' : 'Pearce',
            unit: isESL ? (i < 3 ? '1FTS' : 'CFS') : '2FTS', // Deterministic: 3 to 1FTS, 1 to CFS
            phoneNumber,
            email,
            unavailability: [],
            permissions: ['Staff'],
        });
    }

    const rankOrder: { [key: string]: number } = {
        'WGCDR': 1,
        'SQNLDR': 2,
        'FLTLT': 3,
        'FLGOFF': 4,
        'PLTOFF': 5,
        'Mr': 6
    };

    const sortedQfis = qfis.sort((a, b) => {
        const rankA = rankOrder[a.rank] || 99;
        const rankB = rankOrder[b.rank] || 99;
        if (rankA !== rankB) {
            return rankA - rankB;
        }
        return a.name.localeCompare(b.name);
    });

    return [...sortedQfis, ...simIps.sort((a,b) => a.name.localeCompare(b.name))];
};


// --- COURSE PROGRESS & SCORE SIMULATION ---
const courseProgressRanges: { [key: string]: { start: string; end: string } } = {
  'ADF301': { start: 'BIF4', end: 'BGF23' },
  'ADF302': { start: 'BGF15', end: 'BIF4' },
  'ADF303': { start: 'BGF6', end: 'BGF17' },
  'FIC 210': { start: 'BGF1', end: 'BGF5' },
  'FIC211': { start: 'BGF1', end: 'BGF10' },
  'ADF304': { start: 'BGF1', end: 'BGF10' },
  'ADF305': { start: 'BGF5', end: 'BGF15' },
  'IFF 6': { start: 'BIF1', end: 'BIF5' },
};

const simulateProgressAndScores = (
    trainees: Trainee[],
    syllabus: SyllabusItemDetail[],
    instructors: Instructor[]
): Map<string, Score[]> => {
    const scoreMap = new Map<string, Score[]>();
    const qfiInstructors = instructors.filter(i => i.role === 'QFI');
    const syllabusIds = syllabus.map(s => s.code);

    trainees.forEach(trainee => {
        const range = courseProgressRanges[trainee.course];
        if (!range) {
            scoreMap.set(trainee.fullName, []);
            return;
        }

        const startIndex = syllabusIds.indexOf(range.start);
        const endIndex = syllabusIds.indexOf(range.end);

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
             scoreMap.set(trainee.fullName, []);
            return;
        }
        
        // Pick a random event index within the range for the trainee's current progress
        const progressIndex = Math.floor(Math.random() * (endIndex - startIndex + 1)) + startIndex;
        
        const completedEvents = syllabus.slice(0, progressIndex);
        const traineeScores: Score[] = [];
        let latestEventDate: Date | null = null;
        let latestFlightDate: Date | null = null;
        
        // Start generating score dates from a random point in the last 6 months
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 180);

        completedEvents.forEach(event => {
            // Generate a random score between 1 and 5, or 5 for completed ground events
            let scoreValue: number;
            if (event.code.includes('MB')) {
                // Mass Brief events get score 5 to indicate completion
                scoreValue = 5;
            } else if (event.type === 'Ground School') {
                // Other ground events get score 5 to indicate completion
                scoreValue = 5;
            } else {
                // Flight events get random score between 1 and 5
                scoreValue = Math.floor(Math.random() * 5) + 1;
            }

            const instructor = qfiInstructors.length > 0
                ? qfiInstructors[Math.floor(Math.random() * qfiInstructors.length)].name
                : 'Unknown Instructor';

            // Move date forward for the next event
            const daysToAdd = Math.floor(Math.random() * 3) + 1; // 1 to 3 days
            startDate.setDate(startDate.getDate() + daysToAdd);
            
            const scoreDate = new Date(startDate);
            
            traineeScores.push({
                event: event.code,
                score: scoreValue as Score['score'],
                date: scoreDate.toISOString().split('T')[0],
                instructor,
                notes: scoreValue === 5 ? `Ground event completed for ${event.code}.` : `Simulated score for ${event.code}.`,
                details: scoreValue === 5 ? [] : [{ criteria: 'General Handling', score: scoreValue, comment: 'Auto-generated comment.' }],
            });
            
            latestEventDate = scoreDate;
            if (event.type === 'Flight') {
                latestFlightDate = scoreDate;
            }
        });

        scoreMap.set(trainee.fullName, traineeScores);
        
        // Update trainee object with the latest dates from the simulation
        if (latestEventDate) {
            trainee.lastEventDate = latestEventDate.toISOString().split('T')[0];
        }
        if (latestFlightDate) {
            trainee.lastFlightDate = latestFlightDate.toISOString().split('T')[0];
        } else if (latestEventDate) {
             // If no flights were completed, last flight date is same as last event date (if any)
            trainee.lastFlightDate = latestEventDate.toISOString().split('T')[0];
        }
    });

    return scoreMap;
};

// --- INSTRUCTOR ALLOCATION ALGORITHM ---
const allocateInstructors = (trainees: Trainee[], instructors: Instructor[]): Trainee[] => {
    const allocatableInstructors = instructors.filter(i => i.role === 'QFI');

    if (!allocatableInstructors.length || !trainees.length) return trainees;

    const traineesWithAssignments: Trainee[] = JSON.parse(JSON.stringify(trainees));
    const eligibleTrainees = traineesWithAssignments.filter(t => !t.course.includes('FIC'));

    if (!eligibleTrainees.length) return traineesWithAssignments;

    // Normalize all instructor fields to arrays
    traineesWithAssignments.forEach(t => {
        if (!Array.isArray(t.primaryInstructor)) {
            t.primaryInstructor = t.primaryInstructor ? [t.primaryInstructor as string] : [];
        }
        if (!Array.isArray(t.secondaryInstructor)) {
            t.secondaryInstructor = t.secondaryInstructor ? [t.secondaryInstructor as string] : [];
        }
    });

    const MAX_PER_INSTRUCTOR = 3;
    const primaryLoad = new Map<string, number>();
    const secondaryLoad = new Map<string, number>();
    allocatableInstructors.forEach(i => { primaryLoad.set(i.name, 0); secondaryLoad.set(i.name, 0); });

    // Helper: Get unit instructors sorted by load
    const getInstructorsByUnit = (unit: string, loadMap: Map<string, number>): Instructor[] => {
        if (!unit) return [];
        return allocatableInstructors
            .filter(i => i.unit === unit && (loadMap.get(i.name) ?? 0) < MAX_PER_INSTRUCTOR)
            .sort((a, b) => (loadMap.get(a.name) ?? 0) - (loadMap.get(b.name) ?? 0));
    };

    // Round 1 and 2: Assign minimum 2 primary instructors per trainee
    for (let round = 0; round < 2; round++) {
        for (const trainee of eligibleTrainees) {
            const primaries = trainee.primaryInstructor as string[];
            if (primaries.length > round) continue;
            if (!trainee.unit) continue;
            const candidates = getInstructorsByUnit(trainee.unit, primaryLoad)
                .filter(i => !primaries.includes(i.name));
            if (!candidates.length) continue;
            primaries.push(candidates[0].name);
            primaryLoad.set(candidates[0].name, (primaryLoad.get(candidates[0].name) ?? 0) + 1);
        }
    }

    // Round 1 and 2: Assign minimum 2 secondary instructors per trainee
    for (let round = 0; round < 2; round++) {
        for (const trainee of eligibleTrainees) {
            const primaries = trainee.primaryInstructor as string[];
            const secondaries = trainee.secondaryInstructor as string[];
            if (secondaries.length > round) continue;
            if (!trainee.unit) continue;
            const candidates = getInstructorsByUnit(trainee.unit, secondaryLoad)
                .filter(i => !secondaries.includes(i.name) && !primaries.includes(i.name));
            const fallback = candidates.length > 0
                ? candidates
                : getInstructorsByUnit(trainee.unit, secondaryLoad).filter(i => !secondaries.includes(i.name));
            if (!fallback.length) continue;
            secondaries.push(fallback[0].name);
            secondaryLoad.set(fallback[0].name, (secondaryLoad.get(fallback[0].name) ?? 0) + 1);
        }
    }

    return traineesWithAssignments;
};

// --- Full Schedule Generation Helper ---
const generateFullSchedule = (
    instructors: Instructor[],
    trainees: Trainee[],
    courses: Course[],
    aircraftCount: number,
    location: 'ESL' | 'PEA',
    date: string
): ScheduleEvent[] => {
    const newEvents: ScheduleEvent[] = [];
    const personnelSchedule: { [key: string]: { start: number, end: number }[] } = {};
    const areas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    const courseColors = Object.fromEntries(courses.map(c => [c.name, c.color]));

    const isAvailable = (personName: string, startTime: number, duration: number) => {
        if (!personnelSchedule[personName]) {
            return true;
        }
        const endTime = startTime + duration;
        return !personnelSchedule[personName].some(slot => 
            startTime < slot.end && endTime > slot.start
        );
    };

    const bookPerson = (personName: string, startTime: number, duration: number) => {
        if (!personnelSchedule[personName]) {
            personnelSchedule[personName] = [];
        }
        personnelSchedule[personName].push({ start: startTime, end: startTime + duration });
    };

    const waves = [
        { start: 8.0, name: 'AM' },
        { start: 10.5, name: 'MID' },
        { start: 13.5, name: 'PM' }
    ];
    
    const timeBetweenTakeoffs = 0.1; // 6 minutes
    
    const qfis = instructors.filter(i => i.role === 'QFI');
    const simIps = instructors.filter(i => i.role === 'SIM IP');
    
    const flightSyllabus = INITIAL_SYLLABUS_DETAILS.filter(s => s.code.startsWith('BGF') && s.type === 'Flight');

    waves.forEach(wave => {
        for (let i = 0; i < aircraftCount; i++) {
            const startTime = wave.start + (i * timeBetweenTakeoffs);
            const syllabusItem = flightSyllabus[Math.floor(Math.random() * flightSyllabus.length)];
            if (!syllabusItem) continue;
            
            const duration = syllabusItem.flightOrSimHours;

            const instructor = qfis.find(inst => isAvailable(inst.name, startTime, duration));
            if (!instructor) continue; 
            
            const trainee = trainees.find(t => !t.isPaused && isAvailable(t.fullName, startTime, duration));
            if (!trainee) continue;

            bookPerson(instructor.name, startTime, duration);
            bookPerson(trainee.fullName, startTime, duration);
            
            newEvents.push({
                id: uuidv4(),
                date: date,
                type: 'flight',
                instructor: instructor.name,
                student: trainee.fullName,
                flightNumber: syllabusItem.code,
                duration: duration,
                startTime: startTime,
                resourceId: `PC-21 ${i + 1}`,
                color: courseColors[trainee.course] || 'bg-gray-400/50',
                flightType: 'Dual',
                locationType: 'Local',
                origin: location,
                destination: location,
                area: areas[Math.floor(Math.random() * areas.length)],
            } as ScheduleEvent);
        }
    });

    // Add some FTDs and Ground events
    const ftdSyllabus = INITIAL_SYLLABUS_DETAILS.filter(s => s.type === 'FTD');
    const groundSyllabus = INITIAL_SYLLABUS_DETAILS.filter(s => s.type === 'Ground School' && s.code.includes('MB'));
    
    for (let i = 0; i < 2; i++) {
        const startTime = 9.0 + i * 2.5;
        const syllabusItem = ftdSyllabus[Math.floor(Math.random() * ftdSyllabus.length)];
        if (!syllabusItem) continue;

        const duration = syllabusItem.flightOrSimHours;
        const simIp = simIps.find(ip => isAvailable(ip.name, startTime, duration));
        if (!simIp) continue;
        
        const trainee = trainees.find(t => !t.isPaused && isAvailable(t.fullName, startTime, duration));
        if (!trainee) continue;

        bookPerson(simIp.name, startTime, duration);
        bookPerson(trainee.fullName, startTime, duration);

        newEvents.push({
            id: uuidv4(),
            date: date,
            type: 'ftd',
            instructor: simIp.name,
            student: trainee.fullName,
            flightNumber: syllabusItem.code,
            duration: duration,
            startTime: startTime,
            resourceId: `FTD ${i + 1}`,
            color: 'bg-indigo-400/50',
            flightType: 'Dual',
            locationType: 'Local',
            origin: location,
            destination: location,
        } as ScheduleEvent);
    }

    const groundSyllabusItem = groundSyllabus[Math.floor(Math.random() * groundSyllabus.length)];
    const qfiForGround = qfis.find(q => isAvailable(q.name, 16.0, 1.0));
    const courseForGround = courses[0]?.name;
    const traineesForGround = courseForGround ? trainees.filter(t => t.course === courseForGround && isAvailable(t.fullName, 16.0, 1.0)).slice(0, 10) : [];
    
    if (qfiForGround && traineesForGround.length > 0 && groundSyllabusItem) {
        bookPerson(qfiForGround.name, 16.0, 1.0);
        traineesForGround.forEach(t => bookPerson(t.fullName, 16.0, 1.0));
        
        // Determine if this is a CPT event based on methodOfDelivery
        const isCPT = groundSyllabusItem.methodOfDelivery.includes('CPT');
        const eventType = isCPT ? 'cpt' : 'ground';
        const resourceId = isCPT ? 'CPT 1' : 'Ground 1';
        
        newEvents.push({
            id: uuidv4(),
            date: date,
            type: eventType,
            instructor: qfiForGround.name,
            attendees: traineesForGround.map(t => t.fullName),
            flightNumber: groundSyllabusItem.code,
            duration: 1.0,
            startTime: 16.0,
            resourceId: resourceId,
            color: 'bg-teal-400/50',
            flightType: 'Dual',
            locationType: 'Local',
            origin: location,
            destination: location
        } as ScheduleEvent);
    }

    return newEvents;
};

// --- Historical Logbook Data Generation ---
const generateHistoricalEvents = (instructors: Instructor[], trainees: Trainee[], syllabus: SyllabusItemDetail[]) => {
    const events: ScheduleEvent[] = [];
    const today = new Date();
    const startHistoryDate = new Date(today.getFullYear(), today.getMonth() - 24, 1);

    const flightSyllabus = syllabus.filter(s => s.type === 'Flight' && !s.code.includes('MB'));
    const ftdSyllabus = syllabus.filter(s => s.type === 'FTD');

    trainees.forEach(trainee => {
        if (trainee.isPaused) return;
        
        for (let i = 0; i < 24; i++) { 
            const monthDate = new Date(startHistoryDate.getFullYear(), startHistoryDate.getMonth() + i, 1);
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            
            for (let j = 0; j < 5; j++) { 
                const isFlight = Math.random() > 0.4;
                const item = isFlight 
                    ? flightSyllabus[Math.floor(Math.random() * flightSyllabus.length)]
                    : ftdSyllabus[Math.floor(Math.random() * ftdSyllabus.length)];
                
                if (!item) continue;

                const instructor = instructors[Math.floor(Math.random() * instructors.length)];
                const dayOfMonth = Math.floor(Math.random() * daysInMonth) + 1;
                const dateStr = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayOfMonth).toISOString().split('T')[0];

                const startTime = 8 + Math.floor(Math.random() * 13); 

                events.push({
                    id: uuidv4(),
                    date: dateStr,
                    type: isFlight ? 'flight' : 'ftd',
                    instructor: instructor.name,
                    student: trainee.fullName,
                    flightNumber: item.code,
                    duration: item.duration,
                    startTime: startTime,
                    resourceId: isFlight ? `PC-21 ${Math.floor(Math.random()*20)+1}` : `FTD ${Math.floor(Math.random()*5)+1}`,
                    color: 'bg-gray-500',
                    flightType: 'Dual',
                    locationType: 'Local',
                    origin: 'ESL',
                    destination: 'ESL'
                } as ScheduleEvent);
            }
        }
    });
    
    return events;
};


// --- EXPORTED DATA ---

const eslCourses: Course[] = [
    { name: 'ADF301', color: 'bg-sky-400/50', startDate: '2025-07-01', gradDate: '2026-02-01', raafStart: 15, navyStart: 5, armyStart: 5 },
    { name: 'ADF302', color: 'bg-purple-400/50', startDate: '2025-07-01', gradDate: '2026-04-01', raafStart: 18, navyStart: 7, armyStart: 0 },
    { name: 'ADF303', color: 'bg-yellow-400/50', startDate: '2025-07-01', gradDate: '2026-02-01', raafStart: 20, navyStart: 5, armyStart: 0 },
    { name: 'FIC 210', color: 'bg-pink-400/50', startDate: '2025-10-01', gradDate: '2026-04-01', raafStart: 4, navyStart: 0, armyStart: 0 },
       { name: 'FIC211', color: 'bg-teal-400/50', startDate: '2025-12-01', gradDate: '2026-06-01', raafStart: 8, navyStart: 2, armyStart: 0 },
   ];

const peaCourses: Course[] = [
    { name: 'ADF304', color: 'bg-teal-400/50', startDate: '2023-02-15', gradDate: '2023-07-20', raafStart: 12, navyStart: 0, armyStart: 0 },
    { name: 'ADF305', color: 'bg-indigo-400/50', startDate: '2023-04-10', gradDate: '2023-10-05', raafStart: 10, navyStart: 2, armyStart: 0 },
    { name: 'IFF 6', color: 'bg-cyan-400/50', startDate: '2023-06-01', gradDate: '2023-08-15', raafStart: 4, navyStart: 0, armyStart: 0 },
       { name: 'FIC211', color: 'bg-teal-400/50', startDate: '2025-12-01', gradDate: '2026-06-01', raafStart: 8, navyStart: 2, armyStart: 0 },
];

const generateDataSet = (location: 'ESL' | 'PEA') => {
    const isESL = location === 'ESL';
    const courses = isESL ? eslCourses : peaCourses;
    const aircraftCount = isESL ? 15 : 12;
    
    // Generate Instructors specifically for this location to ensure correct counts
    const instructors = generateInstructors(location);

    // Generate Trainees
    let trainees: Trainee[] = [];
    courses.forEach(c => {
        const total = c.raafStart + c.navyStart + c.armyStart;
        const distribution = [{ rank: 'PLTOFF' as TraineeRank, count: total }];
        trainees = [...trainees, ...generateTraineesForCourse(c.name, distribution, isESL ? '1FTS' : '2FTS')];
    });

    // Allocate Instructors
    const allocatedTrainees = allocateInstructors(trainees, instructors);

    // Simulate Scores/Progress
    const scores = simulateProgressAndScores(allocatedTrainees, INITIAL_SYLLABUS_DETAILS, instructors);

    // Generate Events for today (timezone-aware to match App.tsx logic)
    const getLocalDateString = (date: Date = new Date()): string => {
        // Apply timezone offset (same as App.tsx - default UTC+11)
        const timezoneOffset = 11; // Default to UTC+11 (AEDT)
        const offsetMs = timezoneOffset * 60 * 60 * 1000;
        const adjustedDate = new Date(date.getTime() + offsetMs);
        
        const year = adjustedDate.getUTCFullYear();
        const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const todayStr = getLocalDateString();
    let events = generateFullSchedule(instructors, allocatedTrainees, courses, aircraftCount, location, todayStr);
    
    // Add Historical Events
    const historicalEvents = generateHistoricalEvents(instructors, allocatedTrainees, INITIAL_SYLLABUS_DETAILS);
    events = [...events, ...historicalEvents];

    // Derived Data
    const courseColors: { [key: string]: string } = {};
    const coursePriorities: string[] = [];
    const coursePercentages = new Map<string, number>();
    const archivedCourses: { [key: string]: string } = {};
    
    courses.forEach((c, idx) => {
        courseColors[c.name] = c.color;
        coursePriorities.push(c.name);
        coursePercentages.set(c.name, Math.floor(100 / courses.length));
    });

    const traineeLMPs = new Map<string, SyllabusItemDetail[]>();
    allocatedTrainees.forEach(t => traineeLMPs.set(t.fullName, INITIAL_SYLLABUS_DETAILS));

    return {
        instructors,
        trainees: allocatedTrainees,
        scores,
        pt051Assessments: new Map<string, Pt051Assessment>(),
        courses,
        courseColors,
        archivedCourses,
        coursePriorities,
        coursePercentages,
        traineeLMPs,
        events
    };
};

export const ESL_DATA = generateDataSet('ESL');
export const PEA_DATA = generateDataSet('PEA');
