// ============================================================
// TRAINING INTELLIGENCE ENGINE (TIE) - Offline Analytics Subsystem
// All analysis uses real PT-051 data from DB; all results stored back in DB
// ============================================================

// ============================================================
// DIAGNOSTIC WRAPPER - logs exact query+params on 42P18 error
// ============================================================
async function safeExec(db, sql, ...params) {
  try {
    return await db.$executeRawUnsafe(sql, ...params);
  } catch (err) {
    if (err.message && err.message.includes('42P18')) {
      // Find which $N is uncast by checking each param
      const paramInfo = params.map((p, i) => {
        const type = p === null ? 'NULL' : typeof p;
        const val = p === null ? 'NULL' : String(p).substring(0, 50);
        return `  $${i+1}: [${type}] ${val}`;
      }).join('\n');
      console.error(`\n🔴 42P18 ERROR - EXACT QUERY:\n${sql}\nPARAMS (${params.length} total):\n${paramInfo}\n`);
    }
    throw err;
  }
}

async function safeQuery(db, sql, ...params) {
  try {
    return await db.$queryRawUnsafe(sql, ...params);
  } catch (err) {
    if (err.message && err.message.includes('42P18')) {
      const paramInfo = params.map((p, i) => {
        const type = p === null ? 'NULL' : typeof p;
        const val = p === null ? 'NULL' : String(p).substring(0, 50);
        return `  $${i+1}: [${type}] ${val}`;
      }).join('\n');
      console.error(`\n🔴 42P18 ERROR - EXACT QUERY:\n${sql}\nPARAMS (${params.length} total):\n${paramInfo}\n`);
    }
    throw err;
  }
}

// ============================================================
// SECTION 1: DB MIGRATION - Create TIE tables if not present
// ============================================================
async function ensureTIETables(db) {
  try {
    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIESettings" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "key" TEXT NOT NULL UNIQUE,
        "value" JSONB NOT NULL,
        "description" TEXT,
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIECommentDictionary" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "phrase" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "weight" FLOAT DEFAULT 1.0,
        "matchType" TEXT DEFAULT 'contains',
        "isActive" BOOLEAN DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIESkillMapping" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "element" TEXT NOT NULL,
        "skillFamily" TEXT NOT NULL,
        "weight" FLOAT DEFAULT 1.0,
        "isActive" BOOLEAN DEFAULT TRUE
      )
    `);
    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIEEventRelationship" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "fromEvent" TEXT NOT NULL,
        "toEvent" TEXT NOT NULL,
        "relationshipType" TEXT NOT NULL,
        "skillFamily" TEXT,
        "sequenceOrder" INT,
        "isActive" BOOLEAN DEFAULT TRUE
      )
    `);
    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIEAnalyticsRun" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runType" TEXT NOT NULL,
        "courseFilter" TEXT,
        "status" TEXT DEFAULT 'pending',
        "startedAt" TIMESTAMPTZ DEFAULT NOW(),
        "completedAt" TIMESTAMPTZ,
        "recordsProcessed" INT DEFAULT 0,
        "logicVersion" TEXT DEFAULT '1.0',
        "thresholdsUsed" JSONB,
        "errorMessage" TEXT,
        "triggeredBy" TEXT
      )
    `);
    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIENormalisedInput" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "sourcePt051Id" TEXT NOT NULL,
        "traineeFullName" TEXT NOT NULL,
        "courseId" TEXT,
        "courseName" TEXT,
        "instructorName" TEXT,
        "eventCode" TEXT NOT NULL,
        "eventDate" DATE NOT NULL,
        "syllabusPosition" INT,
        "overallGrade" INT,
        "overallResult" TEXT,
        "elementScores" JSONB NOT NULL DEFAULT '{}',
        "commentsByElement" JSONB NOT NULL DEFAULT '{}',
        "overallComment" TEXT,
        "isFirstAttempt" BOOLEAN DEFAULT TRUE,
        "isRepeat" BOOLEAN DEFAULT FALSE,
        "isRemedial" BOOLEAN DEFAULT FALSE,
        "recencyWeight" FLOAT DEFAULT 1.0,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_norm_course ON "TIENormalisedInput"("courseName")`);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_norm_trainee ON "TIENormalisedInput"("traineeFullName")`);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_norm_event ON "TIENormalisedInput"("eventCode")`);

    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIECommentTag" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "sourcePt051Id" TEXT NOT NULL,
        "traineeFullName" TEXT NOT NULL,
        "eventCode" TEXT NOT NULL,
        "element" TEXT NOT NULL,
        "tag" TEXT NOT NULL,
        "tagCategory" TEXT NOT NULL,
        "matchedPhrase" TEXT,
        "confidence" FLOAT DEFAULT 1.0
      )
    `);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_tag_trainee ON "TIECommentTag"("traineeFullName")`);

    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIEFinding" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "level" TEXT NOT NULL,
        "subjectKey" TEXT NOT NULL,
        "findingType" TEXT NOT NULL,
        "skillFamily" TEXT,
        "element" TEXT,
        "descriptiveFinding" TEXT NOT NULL,
        "interpretedInsight" TEXT,
        "recommendation" TEXT,
        "confidenceLevel" TEXT DEFAULT 'medium',
        "confidenceScore" FLOAT DEFAULT 0.5,
        "confidenceReason" TEXT,
        "evidenceCount" INT DEFAULT 0,
        "sourcePt051Ids" JSONB DEFAULT '[]',
        "trendDirection" TEXT,
        "recencyNote" TEXT,
        "isActive" BOOLEAN DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_finding_level ON "TIEFinding"("level","subjectKey")`);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_finding_run ON "TIEFinding"("runId")`);

    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIETraineeSummary" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "traineeFullName" TEXT NOT NULL,
        "courseName" TEXT,
        "overallTrend" TEXT,
        "riskLevel" TEXT DEFAULT 'normal',
        "strongestSkillFamilies" JSONB DEFAULT '[]',
        "weakestSkillFamilies" JSONB DEFAULT '[]',
        "recurringWeakElements" JSONB DEFAULT '[]',
        "positiveCommentThemes" JSONB DEFAULT '[]',
        "negativeCommentThemes" JSONB DEFAULT '[]',
        "totalPt051Count" INT DEFAULT 0,
        "avgOverallGrade" FLOAT,
        "recentAvgGrade" FLOAT,
        "gradeProgression" JSONB DEFAULT '[]',
        "narrativeSummary" TEXT,
        "atRiskReasons" JSONB DEFAULT '[]',
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_trainee_name ON "TIETraineeSummary"("traineeFullName")`);
    await safeExec(db, `CREATE INDEX IF NOT EXISTS idx_tie_trainee_risk ON "TIETraineeSummary"("riskLevel")`);

    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIEEventSummary" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "eventCode" TEXT NOT NULL,
        "courseName" TEXT NOT NULL,
        "totalAttempts" INT DEFAULT 0,
        "avgOverallGrade" FLOAT,
        "gradeVariance" FLOAT,
        "passRate" FLOAT,
        "weakElementsByAvg" JSONB DEFAULT '[]',
        "strongElementsByAvg" JSONB DEFAULT '[]',
        "dominantNegativeTags" JSONB DEFAULT '[]',
        "dominantPositiveTags" JSONB DEFAULT '[]',
        "difficultyScore" FLOAT,
        "bottleneckScore" FLOAT,
        "overServiceIndicator" BOOLEAN DEFAULT FALSE,
        "differentiationScore" FLOAT,
        "syllabusPosition" INT,
        "narrativeSummary" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIECourseSummary" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "courseName" TEXT NOT NULL,
        "totalTrainees" INT DEFAULT 0,
        "totalPt051s" INT DEFAULT 0,
        "bottleneckEvents" JSONB DEFAULT '[]',
        "bottleneckSkillFamilies" JSONB DEFAULT '[]',
        "atRiskTrainees" JSONB DEFAULT '[]',
        "exceedingTrainees" JSONB DEFAULT '[]',
        "commonFailureChains" JSONB DEFAULT '[]',
        "overServicedEvents" JSONB DEFAULT '[]',
        "skillHeatmap" JSONB DEFAULT '{}',
        "narrativeSummary" TEXT,
        "lastCalculated" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIEUnitSummary" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "unitName" TEXT NOT NULL,
        "totalTrainees" INT DEFAULT 0,
        "totalPt051s" INT DEFAULT 0,
        "mostCommonWeaknesses" JSONB DEFAULT '[]',
        "strongestSkillFamilies" JSONB DEFAULT '[]',
        "weakestSkillFamilies" JSONB DEFAULT '[]',
        "instructorConsistency" JSONB DEFAULT '{}',
        "narrativeSummary" TEXT,
        "lastCalculated" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await safeExec(db, `
      CREATE TABLE IF NOT EXISTS "TIERootCause" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "runId" TEXT NOT NULL,
        "level" TEXT NOT NULL,
        "subjectKey" TEXT NOT NULL,
        "likelyCause" TEXT NOT NULL,
        "causeCategory" TEXT NOT NULL,
        "supportingFindings" JSONB DEFAULT '[]',
        "confidenceScore" FLOAT DEFAULT 0.5,
        "confidenceLevel" TEXT DEFAULT 'medium',
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('✅ TIE tables ensured');
    return true;
  } catch (err) {
    console.error('❌ TIE table migration error:', err.message);
    return false;
  }
}

// ============================================================
// SECTION 2: SEED DEFAULT SETTINGS & DICTIONARIES
// ============================================================
async function seedTIEDefaults(db) {
  // Default settings
  const defaults = [
    { key: 'concern_threshold_grade', value: 3, description: 'Grade at or below which an element is flagged as concern (scale 1-5)' },
    { key: 'min_observations_for_pattern', value: 3, description: 'Minimum PT-051 records before flagging a pattern' },
    { key: 'recency_weight_factor', value: 1.5, description: 'Multiplier applied to most recent 30% of events' },
    { key: 'comment_weight_vs_score', value: 0.4, description: 'Weight of comment tags vs numeric scores (0-1)' },
    { key: 'bottleneck_threshold_pct', value: 40, description: 'Pct of trainees scoring at/below concern threshold to flag bottleneck' },
    { key: 'over_service_threshold', value: 85, description: 'Avg grade above which an event may be over-serviced' },
    { key: 'at_risk_avg_grade', value: 3.2, description: 'Avg grade below which a trainee is at-risk' },
    { key: 'exceeding_avg_grade', value: 4.2, description: 'Avg grade above which a trainee is exceeding' },
    { key: 'high_variance_threshold', value: 1.0, description: 'Grade standard deviation above which event has high variance' },
  ];

  for (const d of defaults) {
    const existing = await safeQuery(db, `SELECT id FROM "TIESettings" WHERE key = $1`, d.key);
    if (!existing || existing.length === 0) {
      await safeExec(db, 
        `INSERT INTO "TIESettings"("id","key","value","description") VALUES(gen_random_uuid()::text,$1,$2::jsonb,$3)`,
        d.key, JSON.stringify(d.value), d.description
      );
    }
  }

  // Comment dictionaries
  const dictionaryCount = await safeQuery(db, `SELECT COUNT(*) as cnt FROM "TIECommentDictionary"`);
  if (dictionaryCount[0].cnt == 0) {
    const phrases = [
      // POSITIVE
      { phrase: 'strong', category: 'positive', weight: 1.0 },
      { phrase: 'confident', category: 'positive', weight: 1.2 },
      { phrase: 'excellent', category: 'positive', weight: 1.5 },
      { phrase: 'demonstrated strong', category: 'positive', weight: 1.3 },
      { phrase: 'good precision', category: 'positive', weight: 1.2 },
      { phrase: 'well prepared', category: 'positive', weight: 1.1 },
      { phrase: 'precise', category: 'positive', weight: 1.1 },
      { phrase: 'accurate', category: 'positive', weight: 1.0 },
      { phrase: 'independent', category: 'positive', weight: 1.2 },
      { phrase: 'no prompting', category: 'positive', weight: 1.3 },
      { phrase: 'without prompting', category: 'positive', weight: 1.3 },
      { phrase: 'consistently', category: 'positive', weight: 1.1 },
      { phrase: 'ahead of the aircraft', category: 'positive', weight: 1.4 },
      { phrase: 'proactive', category: 'positive', weight: 1.2 },
      { phrase: 'high standard', category: 'positive', weight: 1.3 },
      { phrase: 'above standard', category: 'positive', weight: 1.4 },
      { phrase: 'fluent', category: 'positive', weight: 1.1 },
      { phrase: 'effective lookout', category: 'positive', weight: 1.3 },
      { phrase: 'correct technique', category: 'positive', weight: 1.1 },
      { phrase: 'disciplined', category: 'positive', weight: 1.1 },
      // NEGATIVE
      { phrase: 'weak', category: 'negative', weight: 1.0 },
      { phrase: 'poor', category: 'negative', weight: 1.1 },
      { phrase: 'below standard', category: 'negative', weight: 1.3 },
      { phrase: 'inconsistent', category: 'negative', weight: 1.0 },
      { phrase: 'rushing', category: 'negative', weight: 1.2 },
      { phrase: 'rushed', category: 'negative', weight: 1.2 },
      { phrase: 'behind the aircraft', category: 'negative', weight: 1.5 },
      { phrase: 'overcontrolling', category: 'negative', weight: 1.2 },
      { phrase: 'over-controlling', category: 'negative', weight: 1.2 },
      { phrase: 'slow scan', category: 'negative', weight: 1.2 },
      { phrase: 'missed', category: 'negative', weight: 1.0 },
      { phrase: 'omitted', category: 'negative', weight: 1.1 },
      { phrase: 'incorrect', category: 'negative', weight: 1.1 },
      { phrase: 'prompting required', category: 'negative', weight: 1.4 },
      { phrase: 'required prompting', category: 'negative', weight: 1.4 },
      { phrase: 'prompted', category: 'negative', weight: 1.3 },
      { phrase: 'needs prompting', category: 'negative', weight: 1.3 },
      { phrase: 'high workload', category: 'negative', weight: 1.2 },
      { phrase: 'saturated', category: 'negative', weight: 1.3 },
      { phrase: 'late', category: 'negative', weight: 1.0 },
      { phrase: 'distracted', category: 'negative', weight: 1.1 },
      { phrase: 'confused', category: 'negative', weight: 1.2 },
      { phrase: 'struggled', category: 'negative', weight: 1.1 },
      { phrase: 'difficulty', category: 'negative', weight: 1.0 },
      { phrase: 'errors', category: 'negative', weight: 1.1 },
      { phrase: 'imprecise', category: 'negative', weight: 1.0 },
      { phrase: 'remedial', category: 'negative', weight: 1.5 },
      // TREND - IMPROVING
      { phrase: 'improved', category: 'trend_improving', weight: 1.3 },
      { phrase: 'improving', category: 'trend_improving', weight: 1.2 },
      { phrase: 'progressing', category: 'trend_improving', weight: 1.1 },
      { phrase: 'better than previous', category: 'trend_improving', weight: 1.4 },
      { phrase: 'showed improvement', category: 'trend_improving', weight: 1.3 },
      { phrase: 'recovery', category: 'trend_improving', weight: 1.2 },
      { phrase: 'recovered', category: 'trend_improving', weight: 1.2 },
      { phrase: 'building confidence', category: 'trend_improving', weight: 1.1 },
      { phrase: 'growing', category: 'trend_improving', weight: 1.0 },
      // TREND - WORSENING / RECURRING
      { phrase: 'recurring', category: 'trend_worsening', weight: 1.4 },
      { phrase: 'persistent', category: 'trend_worsening', weight: 1.3 },
      { phrase: 'still weak', category: 'trend_worsening', weight: 1.4 },
      { phrase: 'continues to', category: 'trend_worsening', weight: 1.2 },
      { phrase: 'repeated', category: 'trend_worsening', weight: 1.2 },
      { phrase: 'again', category: 'trend_worsening', weight: 1.0 },
      { phrase: 'not yet', category: 'trend_worsening', weight: 1.1 },
      // SEVERITY
      { phrase: 'significant', category: 'severity', weight: 1.3 },
      { phrase: 'serious', category: 'severity', weight: 1.5 },
      { phrase: 'major', category: 'severity', weight: 1.4 },
      { phrase: 'critical', category: 'severity', weight: 1.6 },
      // NEUTRAL
      { phrase: 'satisfactory', category: 'neutral', weight: 1.0 },
      { phrase: 'acceptable', category: 'neutral', weight: 1.0 },
      { phrase: 'meets standard', category: 'neutral', weight: 1.0 },
      { phrase: 'adequate', category: 'neutral', weight: 0.9 },
    ];
    for (const p of phrases) {
      await safeExec(db, 
        `INSERT INTO "TIECommentDictionary"("id","phrase","category","weight","matchType") VALUES(gen_random_uuid()::text,$1,$2,$3,'contains')`,
        p.phrase, p.category, p.weight
      );
    }
    console.log(`✅ TIE: Seeded ${phrases.length} comment dictionary phrases`);
  }

  // Skill mappings
  const mappingCount = await safeQuery(db, `SELECT COUNT(*) as cnt FROM "TIESkillMapping"`);
  if (mappingCount[0].cnt == 0) {
    const mappings = [
      { element: 'Lookout', skillFamily: 'Situational Awareness' },
      { element: 'Lookout', skillFamily: 'Airmanship' },
      { element: 'Situational Awareness', skillFamily: 'Situational Awareness' },
      { element: 'Situational Awareness', skillFamily: 'Workload Management' },
      { element: 'Radio Comms', skillFamily: 'Communication' },
      { element: 'Radio Comms', skillFamily: 'Workload Management' },
      { element: 'Airborne Checks', skillFamily: 'Procedural Discipline' },
      { element: 'Airborne Checks', skillFamily: 'Workload Management' },
      { element: 'Ground Checks', skillFamily: 'Procedural Discipline' },
      { element: 'Ground Checks', skillFamily: 'Preparation' },
      { element: 'Walk Around', skillFamily: 'Procedural Discipline' },
      { element: 'Walk Around', skillFamily: 'Preparation' },
      { element: 'Pre-Post Flight', skillFamily: 'Procedural Discipline' },
      { element: 'Preparation', skillFamily: 'Preparation' },
      { element: 'Preparation', skillFamily: 'Knowledge' },
      { element: 'Trimming', skillFamily: 'Handling Accuracy' },
      { element: 'Straight and Level', skillFamily: 'Handling Accuracy' },
      { element: 'Level medium Turn', skillFamily: 'Handling Accuracy' },
      { element: 'Level Steep turn', skillFamily: 'Handling Accuracy' },
      { element: 'Technique', skillFamily: 'Handling Accuracy' },
      { element: 'Stationary', skillFamily: 'Handling Accuracy' },
      { element: 'Effects of Control', skillFamily: 'Handling Accuracy' },
      { element: 'Effects of Control', skillFamily: 'Knowledge' },
      { element: 'Landing', skillFamily: 'Takeoff/Landing Technique' },
      { element: 'Landing', skillFamily: 'Decision Making' },
      { element: 'Landing', skillFamily: 'Handling Accuracy' },
      { element: 'Crosswind', skillFamily: 'Handling Accuracy' },
      { element: 'Crosswind', skillFamily: 'Airmanship' },
      { element: 'Crosswind', skillFamily: 'Decision Making' },
      { element: 'Visual', skillFamily: 'Situational Awareness' },
      { element: 'Visual', skillFamily: 'Communication' },
      { element: 'Visual - Initial & Pitch', skillFamily: 'Situational Awareness' },
      { element: 'Visual - Initial & Pitch', skillFamily: 'Handling Accuracy' },
      { element: 'Airmanship', skillFamily: 'Airmanship' },
      { element: 'Airmanship', skillFamily: 'Situational Awareness' },
      { element: 'Knowledge', skillFamily: 'Knowledge' },
      { element: 'Knowledge', skillFamily: 'Preparation' },
      { element: 'Strap-in', skillFamily: 'Procedural Discipline' },
    ];
    for (const m of mappings) {
      await safeExec(db, 
        `INSERT INTO "TIESkillMapping"("id","element","skillFamily") VALUES(gen_random_uuid()::text,$1,$2)`,
        m.element, m.skillFamily
      );
    }
    console.log(`✅ TIE: Seeded ${mappings.length} skill mappings`);
  }

  // Event relationships (syllabus sequence)
  const relCount = await safeQuery(db, `SELECT COUNT(*) as cnt FROM "TIEEventRelationship"`);
  if (relCount[0].cnt == 0) {
    const relationships = [
      // BGF sequence
      ...['BGF1','BGF2','BGF3','BGF4','BGF5','BGF6','BGF7','BGF8','BGF9','BGF10',
          'BGF11','BGF12','BGF13','BGF14','BGF15','BGF16','BGF17','BGF18','BGF19','BGF20'].map((evt, i, arr) =>
        i < arr.length - 1 ? { from: evt, to: arr[i+1], type: 'follow_on', order: i+1 } : null
      ).filter(Boolean),
      // FTD within BGF
      ...['BGF FTD1','BGF FTD2','BGF FTD3','BGF FTD4','BGF FTD5','BGF FTD6','BGF FTD7','BGF FTD8','BGF FTD9'].map((evt, i, arr) =>
        i < arr.length - 1 ? { from: evt, to: arr[i+1], type: 'follow_on', order: i+1 } : null
      ).filter(Boolean),
      // BGF FTD leads to BGF flights
      { from: 'BGF FTD1', to: 'BGF1', type: 'prerequisite', order: 1 },
      { from: 'BGF FTD2', to: 'BGF3', type: 'prerequisite', order: 2 },
      { from: 'BGF FTD3', to: 'BGF5', type: 'prerequisite', order: 3 },
      // BIF sequence
      ...['BIF1','BIF2','BIF3','BIF4'].map((evt, i, arr) =>
        i < arr.length - 1 ? { from: evt, to: arr[i+1], type: 'follow_on', order: i+100 } : null
      ).filter(Boolean),
    ];
    for (const r of relationships) {
      await safeExec(db, 
        `INSERT INTO "TIEEventRelationship"("id","fromEvent","toEvent","relationshipType","sequenceOrder") VALUES(gen_random_uuid()::text,$1,$2,$3,$4)`,
        r.from, r.to, r.type, r.order || 0
      );
    }
    console.log(`✅ TIE: Seeded ${relationships.length} event relationships`);
  }
}

// ============================================================
// SECTION 3: COMMENT CLASSIFICATION ENGINE
// ============================================================
function classifyComment(text, dictionary) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tags = [];
  for (const entry of dictionary) {
    if (!entry.isActive) continue;
    const phrase = entry.phrase.toLowerCase();
    let matched = false;
    if (entry.matchType === 'exact') {
      matched = lower === phrase;
    } else if (entry.matchType === 'contains') {
      matched = lower.includes(phrase);
    } else if (entry.matchType === 'fuzzy') {
      // Simple fuzzy: allow 1 char difference for phrases > 5 chars
      if (phrase.length > 5 && lower.includes(phrase.slice(0, -1))) matched = true;
      else matched = lower.includes(phrase);
    }
    if (matched) {
      tags.push({
        tag: entry.phrase,
        tagCategory: entry.category,
        matchedPhrase: entry.phrase,
        confidence: Math.min(1.0, entry.weight * (phrase.length / 10))
      });
    }
  }
  return tags;
}

// ============================================================
// SECTION 4: RECENCY WEIGHT CALCULATOR
// ============================================================
function calculateRecencyWeight(eventDate, allDates, factor = 1.5) {
  if (!allDates || allDates.length === 0) return 1.0;
  const sorted = [...allDates].sort();
  const recentCutoff = sorted[Math.floor(sorted.length * 0.7)]; // top 30% = recent
  const d = typeof eventDate === 'string' ? eventDate : eventDate.toISOString().split('T')[0];
  return d >= recentCutoff ? factor : 1.0;
}

// ============================================================
// SECTION 5: SKILL FAMILY AGGREGATOR
// ============================================================
function aggregateBySkillFamily(elementScores, skillMappings) {
  const familyScores = {};
  const familyCounts = {};
  for (const [element, score] of Object.entries(elementScores)) {
    const families = skillMappings.filter(m => m.element === element && m.isActive);
    for (const mapping of families) {
      if (!familyScores[mapping.skillFamily]) {
        familyScores[mapping.skillFamily] = 0;
        familyCounts[mapping.skillFamily] = 0;
      }
      familyScores[mapping.skillFamily] += score * (mapping.weight || 1.0);
      familyCounts[mapping.skillFamily] += (mapping.weight || 1.0);
    }
  }
  const result = {};
  for (const family of Object.keys(familyScores)) {
    result[family] = familyCounts[family] > 0 ? familyScores[family] / familyCounts[family] : null;
  }
  return result;
}

// ============================================================
// SECTION 6: CONFIDENCE CALCULATOR
// ============================================================
function calculateConfidence(params) {
  const { observationCount, patternConsistency, recencyBonus, spreadBonus, commentSupport } = params;

  let score = 0;

  // Observation count contribution (0-0.4)
  if (observationCount >= 10) score += 0.4;
  else if (observationCount >= 5) score += 0.25;
  else if (observationCount >= 3) score += 0.15;
  else score += 0.05;

  // Pattern consistency (0-0.3): 0-1 float from caller
  score += (patternConsistency || 0) * 0.3;

  // Recency bonus (0-0.1)
  score += (recencyBonus || 0) * 0.1;

  // Spread bonus (0-0.1): how many different trainees show pattern
  score += (spreadBonus || 0) * 0.1;

  // Comment support (0-0.1)
  score += (commentSupport || 0) * 0.1;

  score = Math.min(1.0, Math.max(0.0, score));
  const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
  return { score, level };
}

// ============================================================
// SECTION 7: TREND DETECTOR
// ============================================================
function detectTrend(gradeSequence) {
  if (!gradeSequence || gradeSequence.length < 2) return 'insufficient_data';
  const n = gradeSequence.length;
  // Linear regression slope
  const xMean = (n - 1) / 2;
  const yMean = gradeSequence.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (gradeSequence[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  if (slope > 0.1) return 'improving';
  if (slope < -0.1) return 'worsening';
  return 'stable';
}

// ============================================================
// SECTION 8: NARRATIVE GENERATOR
// ============================================================
function generateTraineeNarrative(data) {
  const { traineeFullName, totalPt051Count, avgGrade, recentAvg, trend,
          weakElements, strongElements, negTags, posTags, atRisk, riskReasons } = data;

  const name = traineeFullName.split(',')[0] || traineeFullName;
  const parts = [];

  if (totalPt051Count < 3) {
    return `${name} has ${totalPt051Count} PT-051 record(s) on file. Insufficient data for comprehensive analysis.`;
  }

  // Overall performance
  const gradeDesc = avgGrade >= 4.0 ? 'above average' : avgGrade >= 3.5 ? 'average' : 'below average';
  parts.push(`${name}'s overall performance across ${totalPt051Count} PT-051 assessments is ${gradeDesc} with a mean grade of ${avgGrade.toFixed(2)}.`);

  // Trend
  if (trend === 'improving') parts.push(`Performance is showing an improving trend over the assessment period.`);
  else if (trend === 'worsening') parts.push(`Performance has been declining over the assessment period — this warrants instructor attention.`);
  else if (trend === 'stable') {
    if (avgGrade < 3.5) parts.push(`Performance has remained consistently below average with no clear improvement.`);
    else parts.push(`Performance has been consistent and stable.`);
  }

  // Recent vs historical
  if (recentAvg && Math.abs(recentAvg - avgGrade) > 0.2) {
    if (recentAvg > avgGrade) parts.push(`Recent assessments (avg ${recentAvg.toFixed(2)}) are stronger than the historical average, indicating positive momentum.`);
    else parts.push(`Recent assessments (avg ${recentAvg.toFixed(2)}) are weaker than the historical average — performance may be deteriorating.`);
  }

  // Weak elements
  if (weakElements && weakElements.length > 0) {
    const elList = weakElements.slice(0, 3).join(', ');
    parts.push(`Recurring weakness areas include: ${elList}.`);
  }

  // Strong elements
  if (strongElements && strongElements.length > 0) {
    const stList = strongElements.slice(0, 2).join(', ');
    parts.push(`Consistently strong performance has been noted in ${stList}.`);
  }

  // Comment themes
  if (negTags && negTags.length > 0) {
    const themes = [...new Set(negTags.slice(0, 3))].join(', ');
    parts.push(`Instructor comments frequently reference: ${themes}.`);
  }

  // Risk
  if (atRisk) {
    const reasons = (riskReasons || []).slice(0, 2).join('; ');
    parts.push(`⚠ This trainee is flagged at-risk. Key concerns: ${reasons}.`);
  }

  return parts.join(' ');
}

function generateEventNarrative(data) {
  const { eventCode, courseName, totalAttempts, avgGrade, variance, weakElements, bottleneck, overService } = data;
  const parts = [];

  parts.push(`${eventCode} (${courseName}) has ${totalAttempts} recorded assessments with a mean overall grade of ${(avgGrade || 0).toFixed(2)}.`);

  if (bottleneck) {
    parts.push(`This event is a training bottleneck — a high proportion of trainees are recording weak results, particularly in ${(weakElements || []).slice(0, 2).join(' and ')}.`);
  } else if (overService) {
    parts.push(`Performance in this event is consistently high. This may indicate the event is being over-serviced relative to current trainee capability.`);
  } else if (avgGrade >= 3.5) {
    parts.push(`Performance is generally satisfactory.`);
  }

  if (variance > 1.0) {
    parts.push(`Grade variance is high (σ=${variance.toFixed(2)}), suggesting inconsistent outcomes across the trainee population.`);
  } else if (variance < 0.4) {
    parts.push(`Very low grade variance suggests this event reliably produces consistent outcomes.`);
  }

  if (weakElements && weakElements.length > 0) {
    parts.push(`Lowest-performing elements are: ${weakElements.slice(0, 3).join(', ')}.`);
  }

  return parts.join(' ');
}

function generateCourseNarrative(data) {
  const { courseName, totalTrainees, totalPt051s, bottleneckEvents, atRiskTrainees, bottleneckSkills } = data;
  const parts = [];

  parts.push(`${courseName} has ${totalTrainees} trainees with ${totalPt051s} PT-051 assessments on record.`);

  if (bottleneckEvents && bottleneckEvents.length > 0) {
    parts.push(`Bottleneck events identified: ${bottleneckEvents.slice(0, 3).join(', ')}. These events show concentrated low performance.`);
  }

  if (bottleneckSkills && bottleneckSkills.length > 0) {
    parts.push(`Most problematic skill families: ${bottleneckSkills.slice(0, 3).join(', ')}.`);
  }

  if (atRiskTrainees && atRiskTrainees.length > 0) {
    parts.push(`${atRiskTrainees.length} trainee(s) are currently flagged as at-risk.`);
  }

  return parts.join(' ');
}

// ============================================================
// SECTION 9: ROOT CAUSE INFERENCE ENGINE
// ============================================================
function inferRootCauses(weakSkillFamilies, negTags, weakElements) {
  const causes = [];

  const hasWorkloadIssues = weakSkillFamilies.includes('Workload Management') ||
    negTags.some(t => ['behind the aircraft','rushing','rushed','saturated','high workload'].includes(t));
  const hasProceduralIssues = weakSkillFamilies.includes('Procedural Discipline') ||
    weakElements.some(e => ['Airborne Checks','Ground Checks','Walk Around','Pre-Post Flight'].includes(e));
  const hasHandlingIssues = weakSkillFamilies.includes('Handling Accuracy') ||
    weakElements.some(e => ['Trimming','Straight and Level','Level medium Turn','Level Steep turn'].includes(e));
  const hasAirmanshipIssues = weakSkillFamilies.includes('Airmanship') ||
    weakSkillFamilies.includes('Situational Awareness');
  const hasPrepIssues = weakSkillFamilies.includes('Preparation') ||
    weakElements.some(e => ['Preparation','Knowledge'].includes(e));
  const hasCommIssues = weakSkillFamilies.includes('Communication') ||
    weakElements.some(e => ['Radio Comms'].includes(e));

  if (hasWorkloadIssues && hasProceduralIssues) {
    causes.push({
      likelyCause: 'Workload management and procedural discipline breakdown under task complexity',
      causeCategory: 'workload_management',
      confidence: 0.75
    });
  } else if (hasWorkloadIssues) {
    causes.push({
      likelyCause: 'Workload management — trainee is overloaded during complex or combined task events',
      causeCategory: 'workload_management',
      confidence: 0.65
    });
  }

  if (hasHandlingIssues && weakElements.some(e => ['Landing','Crosswind'].includes(e))) {
    causes.push({
      likelyCause: 'Fundamental handling accuracy weakness affecting landing and maneuvering tasks',
      causeCategory: 'handling_accuracy',
      confidence: 0.70
    });
  } else if (hasHandlingIssues) {
    causes.push({
      likelyCause: 'Handling accuracy — basic aircraft control precision is below required standard',
      causeCategory: 'handling_accuracy',
      confidence: 0.60
    });
  }

  if (hasPrepIssues && negTags.some(t => ['poor','weak','missed'].includes(t))) {
    causes.push({
      likelyCause: 'Pre-event preparation and knowledge integration — trainee is not adequately prepared before sorties',
      causeCategory: 'preparation',
      confidence: 0.65
    });
  }

  if (hasProceduralIssues && !hasWorkloadIssues) {
    causes.push({
      likelyCause: 'Procedural discipline — check flows are not fully internalised and require active prompting',
      causeCategory: 'procedural_discipline',
      confidence: 0.60
    });
  }

  if (hasAirmanshipIssues && hasCommIssues) {
    causes.push({
      likelyCause: 'Situational awareness and communication — trainee is not maintaining an effective picture of the flight environment',
      causeCategory: 'situational_awareness',
      confidence: 0.65
    });
  }

  return causes;
}

// ============================================================
// SECTION 10: MAIN ANALYTICS ENGINE
// ============================================================
async function runTIEAnalytics(db, courseFilter, triggeredBy = 'manual') {
  console.log(`🧠 TIE: Starting analytics run for course: ${courseFilter || 'ALL'}`);

  // Create analytics run record
  const runRows = await safeQuery(db, `
    INSERT INTO "TIEAnalyticsRun"("id","runType","courseFilter","status","logicVersion","triggeredBy")
    VALUES(gen_random_uuid()::text,$1::text,$2::text,'running','1.0',$3::text)
    RETURNING id
  `, courseFilter ? 'course' : 'full', courseFilter || null, triggeredBy);
  const runId = runRows[0].id;

  try {
    // ── Load settings ──────────────────────────────────────────
    const settingsRows = await safeQuery(db, `SELECT key, value FROM "TIESettings"`);
    const settings = {};
    for (const row of settingsRows) {
      settings[row.key] = typeof row.value === 'object' ? row.value : JSON.parse(row.value);
    }
    const CONCERN_THRESHOLD = Number(settings.concern_threshold_grade) || 3;
    const MIN_OBS = Number(settings.min_observations_for_pattern) || 3;
    const RECENCY_FACTOR = Number(settings.recency_weight_factor) || 1.5;
    const BOTTLENECK_PCT = Number(settings.bottleneck_threshold_pct) || 40;
    const OVER_SERVICE_AVG = Number(settings.over_service_threshold) || 4.3;
    const AT_RISK_AVG = Number(settings.at_risk_avg_grade) || 3.2;
    const EXCEEDING_AVG = Number(settings.exceeding_avg_grade) || 4.2;

    // ── Load comment dictionary ────────────────────────────────
    const dictionary = await safeQuery(db, `SELECT * FROM "TIECommentDictionary" WHERE "isActive" = TRUE`);

    // ── Load skill mappings ────────────────────────────────────
    const skillMappings = await safeQuery(db, `SELECT * FROM "TIESkillMapping" WHERE "isActive" = TRUE`);

    // ── Load PT-051 data from DataBackup ──────────────────────
    const pt051Backup = await db.dataBackup.findFirst({
      where: { type: 'historical_pt051_assessments' },
      orderBy: { createdAt: 'desc' }
    });
    if (!pt051Backup || !pt051Backup.data) {
      await safeExec(db, `UPDATE "TIEAnalyticsRun" SET status='failed', "completedAt"=NOW(), "errorMessage"=$1 WHERE id=$2`,
        'No PT-051 data found in database', runId);
      return { success: false, error: 'No PT-051 data found', runId };
    }

    const allPt051Raw = typeof pt051Backup.data === 'string' ? JSON.parse(pt051Backup.data) : pt051Backup.data;
    // PT-051 data stored as dict keyed by record ID - extract values
    let pt051Records = Array.isArray(allPt051Raw) ? allPt051Raw : Object.values(allPt051Raw);

    // Filter by course if specified
    if (courseFilter) {
      const cfLower = courseFilter.toLowerCase().trim();
      pt051Records = pt051Records.filter(r => {
        // Check direct course field
        const directCourse = (r.course || r.courseName || '').toLowerCase().trim();
        if (directCourse && (directCourse === cfLower || directCourse.includes(cfLower))) return true;
        // Check traineeFullName embedded course (e.g. "Smith, John – ADF301")
        const name = r.traineeFullName || '';
        const dashPos = name.indexOf('–');
        if (dashPos !== -1) {
          const embedded = name.substring(dashPos + 1).trim().toLowerCase();
          if (embedded === cfLower || embedded.includes(cfLower)) return true;
        }
        return false;
      });
    }

    if (pt051Records.length === 0) {
      await safeExec(db, `UPDATE "TIEAnalyticsRun" SET status='failed', "completedAt"=NOW(), "errorMessage"=$1 WHERE id=$2`,
        'No PT-051 records found for selected course', runId);
      return { success: false, error: 'No records for course', runId };
    }

    // ── Delete previous results for this course/scope ─────────
    if (courseFilter) {
      await safeExec(db, `DELETE FROM "TIENormalisedInput" WHERE "courseName" = $1`, courseFilter);
      await safeExec(db, `DELETE FROM "TIECommentTag" WHERE "traineeFullName" LIKE $1`, `%${courseFilter}%`);
      await safeExec(db, `DELETE FROM "TIEFinding" WHERE "subjectKey" LIKE $1`, `%${courseFilter}%`);
      await safeExec(db, `DELETE FROM "TIETraineeSummary" WHERE "courseName" = $1`, courseFilter);
      await safeExec(db, `DELETE FROM "TIEEventSummary" WHERE "courseName" = $1`, courseFilter);
      await safeExec(db, `DELETE FROM "TIECourseSummary" WHERE "courseName" = $1`, courseFilter);
      await safeExec(db, `DELETE FROM "TIERootCause" WHERE "subjectKey" LIKE $1`, `%${courseFilter}%`);
    } else {
      await safeExec(db, `DELETE FROM "TIENormalisedInput" WHERE TRUE`);
      await safeExec(db, `DELETE FROM "TIECommentTag" WHERE TRUE`);
      await safeExec(db, `DELETE FROM "TIEFinding" WHERE TRUE`);
      await safeExec(db, `DELETE FROM "TIETraineeSummary" WHERE TRUE`);
      await safeExec(db, `DELETE FROM "TIEEventSummary" WHERE TRUE`);
      await safeExec(db, `DELETE FROM "TIECourseSummary" WHERE TRUE`);
      await safeExec(db, `DELETE FROM "TIERootCause" WHERE TRUE`);
    }

    // ── LAYER 1+2: Ingest and normalise PT-051 data ───────────
    const allDates = pt051Records.map(r => r.date).filter(Boolean).sort();
    const normInputs = [];
    const allCommentTags = [];

    for (const rec of pt051Records) {
      const elementScores = {};
      const commentsByElement = {};

      for (const s of (rec.scores || [])) {
        if (s.element && s.grade != null) {
          elementScores[s.element] = s.grade;
          if (s.comment) commentsByElement[s.element] = s.comment;
        }
      }

      // Extract course from traineeFullName (e.g. "Smith, John – ADF301")
      // or from direct course/courseName field
      let courseName = rec.course || rec.courseName || null;
      if (!courseName && rec.traineeFullName) {
        const emDashIdx = rec.traineeFullName.indexOf('–');
        if (emDashIdx !== -1) {
          courseName = rec.traineeFullName.substring(emDashIdx + 1).trim();
        }
      }

      const recencyWeight = calculateRecencyWeight(rec.date, allDates, RECENCY_FACTOR);

      const normId = `norm-${runId}-${rec.id}`.substring(0, 200);
      await safeExec(db, `
        INSERT INTO "TIENormalisedInput"
          ("id","runId","sourcePt051Id","traineeFullName","courseName","instructorName",
           "eventCode","eventDate","overallGrade","overallResult",
           "elementScores","commentsByElement","overallComment",
           "isFirstAttempt","isRepeat","isRemedial","recencyWeight")
        VALUES($1::text,$2::text,$3::text,$4::text,$5::text,$6::text,$7::text,$8::date,$9::numeric,$10::text,$11::jsonb,$12::jsonb,$13::text,$14::boolean,$15::boolean,$16::boolean,$17::numeric)
        ON CONFLICT DO NOTHING
      `, normId, runId, rec.id, rec.traineeFullName, courseName, rec.instructorName,
         rec.flightNumber || rec.eventCode || '?',
         rec.date, rec.overallGrade != null ? Number(rec.overallGrade) : null, rec.overallResult || null,
         JSON.stringify(elementScores), JSON.stringify(commentsByElement),
         rec.overallComments || null,
         true, false, false, Number(recencyWeight)
      );

      // ── LAYER 3: Comment tagging ───────────────────────────
      for (const [element, comment] of Object.entries(commentsByElement)) {
        const tags = classifyComment(comment, dictionary);
        for (const tag of tags) {
          const tagId = `tag-${runId}-${rec.id}-${element}-${tag.tag}`.substring(0, 200);
          await safeExec(db, `
            INSERT INTO "TIECommentTag"
              ("id","runId","sourcePt051Id","traineeFullName","eventCode","element","tag","tagCategory","matchedPhrase","confidence")
            VALUES($1::text,$2::text,$3::text,$4::text,$5::text,$6::text,$7::text,$8::text,$9::text,$10::numeric)
            ON CONFLICT DO NOTHING
          `, tagId, runId, rec.id,
             rec.traineeFullName, rec.flightNumber || '?',
             element, tag.tag, tag.tagCategory, tag.matchedPhrase, Number(tag.confidence)
          );
          allCommentTags.push({ traineeFullName: rec.traineeFullName, eventCode: rec.flightNumber, element, ...tag });
        }
      }
      // Tag overall comment
      if (rec.overallComments) {
        const tags = classifyComment(rec.overallComments, dictionary);
        for (const tag of tags) {
          const tagId = `tag-${runId}-${rec.id}-OVERALL-${tag.tag}`.substring(0, 200);
          await safeExec(db, `
            INSERT INTO "TIECommentTag"
              ("id","runId","sourcePt051Id","traineeFullName","eventCode","element","tag","tagCategory","matchedPhrase","confidence")
            VALUES($1::text,$2::text,$3::text,$4::text,$5::text,$6::text,$7::text,$8::text,$9::text,$10::numeric)
            ON CONFLICT DO NOTHING
          `, tagId, runId, rec.id,
             rec.traineeFullName, rec.flightNumber || '?',
             'OVERALL', tag.tag, tag.tagCategory, tag.matchedPhrase, Number(tag.confidence)
          );
        }
      }

      normInputs.push({ ...rec, elementScores, commentsByElement, courseName, recencyWeight });
    }

    // ── LAYER 4+5: Pattern Detection - Group by trainee ──────
    const byTrainee = {};
    for (const rec of normInputs) {
      const k = rec.traineeFullName;
      if (!byTrainee[k]) byTrainee[k] = [];
      byTrainee[k].push(rec);
    }

    // Group by course
    const byCourse = {};
    for (const rec of normInputs) {
      const c = rec.courseName || 'Unknown';
      if (!byCourse[c]) byCourse[c] = [];
      byCourse[c].push(rec);
    }

    // Group by event
    const byEvent = {};
    for (const rec of normInputs) {
      const e = rec.flightNumber || rec.eventCode || '?';
      if (!byEvent[e]) byEvent[e] = [];
      byEvent[e].push(rec);
    }

    // ─── TRAINEE-LEVEL ANALYSIS ───────────────────────────────
    const atRiskTrainees = [];
    const exceedingTrainees = [];

    for (const [traineeFullName, records] of Object.entries(byTrainee)) {
      const sorted = records.sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
      const grades = sorted.map(r => r.overallGrade).filter(g => g != null);
      if (grades.length === 0) continue;

      const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
      const recentCount = Math.max(1, Math.floor(grades.length * 0.3));
      const recentGrades = grades.slice(-recentCount);
      const recentAvg = recentGrades.reduce((a, b) => a + b, 0) / recentGrades.length;
      const trend = detectTrend(grades);
      const courseName = sorted[0].courseName;

      // Element aggregation (with recency weighting)
      const elementTotals = {};
      const elementCounts = {};
      for (const r of records) {
        const rw = r.recencyWeight || 1.0;
        for (const [el, grade] of Object.entries(r.elementScores || {})) {
          if (!elementTotals[el]) { elementTotals[el] = 0; elementCounts[el] = 0; }
          elementTotals[el] += grade * rw;
          elementCounts[el] += rw;
        }
      }
      const elementAvgs = {};
      for (const el of Object.keys(elementTotals)) {
        elementAvgs[el] = elementCounts[el] > 0 ? elementTotals[el] / elementCounts[el] : null;
      }

      // Weak / strong elements
      const weakElements = Object.entries(elementAvgs)
        .filter(([, avg]) => avg != null && avg <= CONCERN_THRESHOLD)
        .sort((a, b) => a[1] - b[1])
        .map(([el]) => el);

      const strongElements = Object.entries(elementAvgs)
        .filter(([, avg]) => avg != null && avg >= 4.0)
        .sort((a, b) => b[1] - a[1])
        .map(([el]) => el);

      // Skill families
      const skillScores = aggregateBySkillFamily(elementAvgs, skillMappings);
      const weakSkillFamilies = Object.entries(skillScores)
        .filter(([, v]) => v != null && v <= CONCERN_THRESHOLD)
        .sort((a, b) => a[1] - b[1])
        .map(([k]) => k);
      const strongSkillFamilies = Object.entries(skillScores)
        .filter(([, v]) => v != null && v >= 4.0)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

      // Comment tag aggregation
      const tagRows = await safeQuery(db, `
        SELECT "tag","tagCategory",COUNT(*) as cnt
        FROM "TIECommentTag"
        WHERE "traineeFullName"=$1 AND "runId"=$2
        GROUP BY "tag","tagCategory"
        ORDER BY cnt DESC
      `, traineeFullName, runId);

      const negTags = tagRows.filter(t => t.tagCategory === 'negative').map(t => t.tag);
      const posTags = tagRows.filter(t => t.tagCategory === 'positive').map(t => t.tag);

      // Grade progression
      const gradeProgression = sorted.map(r => ({
        date: r.date,
        event: r.flightNumber || r.eventCode,
        grade: r.overallGrade,
        recencyWeight: r.recencyWeight
      }));

      // Risk assessment
      const atRisk = avgGrade < AT_RISK_AVG || (trend === 'worsening' && recentAvg < 3.5);
      const exceeding = avgGrade >= EXCEEDING_AVG && trend !== 'worsening';
      const atRiskReasons = [];
      if (avgGrade < AT_RISK_AVG) atRiskReasons.push(`Average grade ${avgGrade.toFixed(2)} below threshold of ${AT_RISK_AVG}`);
      if (trend === 'worsening') atRiskReasons.push('Declining performance trend detected');
      if (weakElements.length >= 3) atRiskReasons.push(`${weakElements.length} weak elements recurring`);

      const riskLevel = atRisk ? 'at_risk' : exceeding ? 'exceeding' : avgGrade >= 3.5 ? 'normal' : 'watch';
      if (atRisk) atRiskTrainees.push(traineeFullName);
      if (exceeding) exceedingTrainees.push(traineeFullName);

      // Narrative
      const narrative = generateTraineeNarrative({
        traineeFullName, totalPt051Count: grades.length,
        avgGrade, recentAvg, trend,
        weakElements, strongElements,
        negTags: negTags.slice(0, 5),
        posTags: posTags.slice(0, 5),
        atRisk, riskReasons: atRiskReasons
      });

      // Insert trainee summary
      const sumId = `tsum-${runId}-${traineeFullName}`.substring(0, 200);
      await safeExec(db, `
        INSERT INTO "TIETraineeSummary"
          ("id","runId","traineeFullName","courseName","overallTrend","riskLevel",
           "strongestSkillFamilies","weakestSkillFamilies","recurringWeakElements",
           "positiveCommentThemes","negativeCommentThemes","totalPt051Count",
           "avgOverallGrade","recentAvgGrade","gradeProgression","narrativeSummary","atRiskReasons")
        VALUES($1::text,$2::text,$3::text,$4::text,$5::text,$6::text,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::int,$13::numeric,$14::numeric,$15::jsonb,$16::text,$17::jsonb)
        ON CONFLICT DO NOTHING
      `, sumId, runId, traineeFullName, courseName, trend, riskLevel,
         JSON.stringify(strongSkillFamilies), JSON.stringify(weakSkillFamilies),
         JSON.stringify(weakElements), JSON.stringify(posTags.slice(0, 8)),
         JSON.stringify(negTags.slice(0, 8)), grades.length,
         Number(avgGrade), Number(recentAvg), JSON.stringify(gradeProgression), narrative,
         JSON.stringify(atRiskReasons)
      );

      // Trainee-level findings
      if (weakElements.length >= 2 && grades.length >= MIN_OBS) {
        const conf = calculateConfidence({
          observationCount: grades.length,
          patternConsistency: weakElements.length / 10,
          recencyBonus: trend === 'worsening' ? 1 : 0,
          commentSupport: negTags.length > 2 ? 1 : 0
        });
        const fid = `f-trainee-weak-${runId}-${traineeFullName}`.substring(0, 200);
        await safeExec(db, `
          INSERT INTO "TIEFinding"
            ("id","runId","level","subjectKey","findingType","descriptiveFinding","interpretedInsight",
             "recommendation","confidenceLevel","confidenceScore","evidenceCount","sourcePt051Ids",
             "trendDirection","element")
          VALUES($1::text,$2::text,'trainee',$3::text,'recurring_weakness',$4::text,$5::text,$6::text,$7::text,$8::numeric,$9::int,$10::jsonb,$11::text,$12::text)
          ON CONFLICT DO NOTHING
        `, fid, runId, traineeFullName,
           `${weakElements.slice(0,3).join(', ')} average at or below ${CONCERN_THRESHOLD} across ${grades.length} PT-051s.`,
           `Recurring weakness in ${weakSkillFamilies.slice(0,2).join(' and ')} — appears consistently across multiple events.`,
           `Focus remedial coaching on ${weakElements[0]}. Consider targeted exercises before next progression event.`,
           conf.level, Number(conf.score), grades.length,
           JSON.stringify(sorted.slice(0,5).map(r => r.id)),
           trend, weakElements.slice(0,3).join(', ')
        );
      }

      // Root cause inference
      if (weakElements.length >= 2) {
        const causes = inferRootCauses(weakSkillFamilies, negTags, weakElements);
        for (const cause of causes) {
          const rcId = `rc-${runId}-${traineeFullName}-${cause.causeCategory}`.substring(0, 200);
          await safeExec(db, `
            INSERT INTO "TIERootCause"
              ("id","runId","level","subjectKey","likelyCause","causeCategory","confidenceScore","confidenceLevel")
            VALUES($1::text,$2::text,'trainee',$3::text,$4::text,$5::text,$6::numeric,$7::text)
            ON CONFLICT DO NOTHING
          `, rcId, runId, traineeFullName, cause.likelyCause, cause.causeCategory,
             Number(cause.confidence), cause.confidence >= 0.7 ? 'high' : cause.confidence >= 0.4 ? 'medium' : 'low'
          );
        }
      }
    }

    // ─── EVENT-TYPE ANALYSIS ──────────────────────────────────
    for (const [eventCode, records] of Object.entries(byEvent)) {
      const grades = records.map(r => r.overallGrade).filter(g => g != null);
      if (grades.length === 0) continue;

      const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
      const variance = grades.length > 1
        ? grades.reduce((sum, g) => sum + (g - avgGrade) ** 2, 0) / grades.length
        : 0;

      // Element averages across all attempts
      const elTotals = {};
      const elCounts = {};
      for (const r of records) {
        for (const [el, grade] of Object.entries(r.elementScores || {})) {
          if (!elTotals[el]) { elTotals[el] = 0; elCounts[el] = 0; }
          elTotals[el] += grade;
          elCounts[el]++;
        }
      }
      const elAvgs = {};
      for (const el of Object.keys(elTotals)) {
        elAvgs[el] = elCounts[el] > 0 ? elTotals[el] / elCounts[el] : null;
      }

      const weakEls = Object.entries(elAvgs)
        .filter(([, avg]) => avg != null && avg <= CONCERN_THRESHOLD)
        .sort((a, b) => a[1] - b[1])
        .map(([el, avg]) => ({ element: el, avg: Math.round(avg * 100) / 100 }));

      const strongEls = Object.entries(elAvgs)
        .filter(([, avg]) => avg != null && avg >= 4.0)
        .sort((a, b) => b[1] - a[1])
        .map(([el, avg]) => ({ element: el, avg: Math.round(avg * 100) / 100 }));

      // Count trainees below concern threshold
      const traineesBelowThreshold = records.filter(r => (r.overallGrade || 0) <= CONCERN_THRESHOLD).length;
      const bottleneckPct = grades.length > 0 ? (traineesBelowThreshold / grades.length) * 100 : 0;
      const isBottleneck = bottleneckPct >= BOTTLENECK_PCT && grades.length >= MIN_OBS;
      const isOverService = avgGrade >= OVER_SERVICE_AVG && variance < 0.5 && grades.length >= MIN_OBS;

      // Difficulty score: inverse of avgGrade normalised
      const difficultyScore = Math.max(0, Math.min(1, (5 - avgGrade) / 3));
      const bottleneckScore = Math.min(1, bottleneckPct / 100);
      const differentiationScore = Math.min(1, variance);

      const courseName = records[0]?.courseName || courseFilter || 'Unknown';

      const tagRows = await safeQuery(db, `
        SELECT "tag","tagCategory",COUNT(*) as cnt
        FROM "TIECommentTag" WHERE "eventCode"=$1 AND "runId"=$2
        GROUP BY "tag","tagCategory" ORDER BY cnt DESC LIMIT 10
      `, eventCode, runId);

      const negTagsEvt = tagRows.filter(t => t.tagCategory === 'negative').map(t => t.tag);
      const posTagsEvt = tagRows.filter(t => t.tagCategory === 'positive').map(t => t.tag);

      const narrative = generateEventNarrative({
        eventCode, courseName, totalAttempts: grades.length,
        avgGrade, variance: Math.sqrt(variance),
        weakElements: weakEls.map(e => e.element),
        bottleneck: isBottleneck, overService: isOverService
      });

      const evtSumId = `esum-${runId}-${eventCode}-${courseName}`.substring(0, 200);
      await safeExec(db, `
        INSERT INTO "TIEEventSummary"
          ("id","runId","eventCode","courseName","totalAttempts","avgOverallGrade","gradeVariance",
           "weakElementsByAvg","strongElementsByAvg","dominantNegativeTags","dominantPositiveTags",
           "difficultyScore","bottleneckScore","overServiceIndicator","differentiationScore",
           "narrativeSummary")
        VALUES($1::text,$2::text,$3::text,$4::text,$5::int,$6::numeric,$7::numeric,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::numeric,$13::numeric,$14::boolean,$15::numeric,$16::text)
        ON CONFLICT DO NOTHING
      `, evtSumId, runId, eventCode, courseName, grades.length,
         Number(avgGrade), Number(variance),
         JSON.stringify(weakEls), JSON.stringify(strongEls),
         JSON.stringify(negTagsEvt), JSON.stringify(posTagsEvt),
         Number(difficultyScore), Number(bottleneckScore), Boolean(isOverService), Number(differentiationScore),
         narrative
      );

      // Event-level findings
      if (isBottleneck && grades.length >= MIN_OBS) {
        const conf = calculateConfidence({
          observationCount: grades.length, patternConsistency: bottleneckPct / 100,
          commentSupport: negTagsEvt.length > 2 ? 1 : 0
        });
        const fid = `f-evt-bottleneck-${runId}-${eventCode}`.substring(0, 200);
        await safeExec(db, `
          INSERT INTO "TIEFinding"
            ("id","runId","level","subjectKey","findingType","descriptiveFinding","interpretedInsight","recommendation",
             "confidenceLevel","confidenceScore","evidenceCount","trendDirection")
          VALUES($1::text,$2::text,'event',$3::text,'bottleneck',$4::text,$5::text,$6::text,$7::text,$8::numeric,$9::int,'stable')
          ON CONFLICT DO NOTHING
        `, fid, runId, eventCode,
           `${bottleneckPct.toFixed(0)}% of trainees score at or below ${CONCERN_THRESHOLD} in ${eventCode} (${grades.length} assessments).`,
           `${eventCode} is a training bottleneck. Weak elements: ${weakEls.slice(0,3).map(e => e.element).join(', ')}.`,
           `Review pre-event preparation and consider whether the syllabus sequence adequately builds the required skills before ${eventCode}.`,
           conf.level, Number(conf.score), grades.length
        );
      }

      if (isOverService && grades.length >= MIN_OBS) {
        const fid = `f-evt-overservice-${runId}-${eventCode}`.substring(0, 200);
        await safeExec(db, `
          INSERT INTO "TIEFinding"
            ("id","runId","level","subjectKey","findingType","descriptiveFinding","interpretedInsight","recommendation",
             "confidenceLevel","confidenceScore","evidenceCount","trendDirection")
          VALUES($1::text,$2::text,'event',$3::text,'over_service',$4::text,$5::text,$6::text,'medium',0.65,$9::int,'stable')
          ON CONFLICT DO NOTHING
        `, fid, runId, eventCode,
           `${eventCode} average grade is ${avgGrade.toFixed(2)} with low variance (σ=${Math.sqrt(variance).toFixed(2)}).`,
           `This event may be over-serviced — trainees consistently perform at or near mastery level before reaching it.`,
           `Review whether this event can be simplified or its training time redistributed to higher-need events.`,
           grades.length
        );
      }
    }

    // ─── COURSE-LEVEL ANALYSIS ────────────────────────────────
    for (const [courseName, records] of Object.entries(byCourse)) {
      const grades = records.map(r => r.overallGrade).filter(g => g != null);
      const trainees = [...new Set(records.map(r => r.traineeFullName))];

      // Bottleneck events for this course
      const courseEventSummaries = await safeQuery(db, `
        SELECT "eventCode","avgOverallGrade","bottleneckScore","overServiceIndicator","totalAttempts"
        FROM "TIEEventSummary" WHERE "runId"=$1 AND "courseName"=$2
        ORDER BY "bottleneckScore" DESC
      `, runId, courseName);

      const bottleneckEvents = courseEventSummaries
        .filter(e => e.bottleneckScore >= 0.4)
        .map(e => e.eventCode);

      const overServicedEvents = courseEventSummaries
        .filter(e => e.overServiceIndicator)
        .map(e => e.eventCode);

      // Skill family heatmap across course
      const elTotals = {};
      const elCounts = {};
      for (const r of records) {
        for (const [el, grade] of Object.entries(r.elementScores || {})) {
          if (!elTotals[el]) { elTotals[el] = 0; elCounts[el] = 0; }
          elTotals[el] += grade;
          elCounts[el]++;
        }
      }
      const elAvgs = {};
      for (const el of Object.keys(elTotals)) {
        elAvgs[el] = elCounts[el] > 0 ? elTotals[el] / elCounts[el] : null;
      }
      const skillHeatmap = aggregateBySkillFamily(elAvgs, skillMappings);

      const bottleneckSkills = Object.entries(skillHeatmap)
        .filter(([, v]) => v != null && v <= CONCERN_THRESHOLD)
        .sort((a, b) => a[1] - b[1])
        .map(([k, v]) => ({ family: k, avg: Math.round(v * 100) / 100 }));

      // At-risk / exceeding trainees for this course
      const courseAtRisk = atRiskTrainees.filter(t => t.includes(courseName));
      const courseExceeding = exceedingTrainees.filter(t => t.includes(courseName));

      const narrative = generateCourseNarrative({
        courseName, totalTrainees: trainees.length, totalPt051s: grades.length,
        bottleneckEvents, atRiskTrainees: courseAtRisk,
        bottleneckSkills: bottleneckSkills.map(s => s.family)
      });

      const csumId = `csum-${runId}-${courseName}`.substring(0, 200);
      await safeExec(db, `
        INSERT INTO "TIECourseSummary"
          ("id","runId","courseName","totalTrainees","totalPt051s","bottleneckEvents",
           "bottleneckSkillFamilies","atRiskTrainees","exceedingTrainees",
           "overServicedEvents","skillHeatmap","narrativeSummary","lastCalculated")
        VALUES($1::text,$2::text,$3::text,$4::int,$5::int,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::text,NOW())
        ON CONFLICT DO NOTHING
      `, csumId, runId, courseName, trainees.length, grades.length,
         JSON.stringify(bottleneckEvents),
         JSON.stringify(bottleneckSkills),
         JSON.stringify(courseAtRisk), JSON.stringify(courseExceeding),
         JSON.stringify(overServicedEvents),
         JSON.stringify(skillHeatmap), narrative
      );

      // Course-level findings
      if (bottleneckEvents.length > 0) {
        const fid = `f-course-bottleneck-${runId}-${courseName}`.substring(0, 200);
        await safeExec(db, `
          INSERT INTO "TIEFinding"
            ("id","runId","level","subjectKey","findingType","descriptiveFinding","interpretedInsight",
             "recommendation","confidenceLevel","confidenceScore","evidenceCount")
          VALUES($1::text,$2::text,'course',$3::text,'bottleneck',$4::text,$5::text,$6::text,'high',0.80,$9::int)
          ON CONFLICT DO NOTHING
        `, fid, runId, courseName,
           `${bottleneckEvents.length} bottleneck events identified in ${courseName}: ${bottleneckEvents.slice(0,3).join(', ')}.`,
           `These events represent concentration points for training difficulty. Primary skill family issues: ${bottleneckSkills.slice(0,2).map(s => s.family).join(', ')}.`,
           `Review pre-event preparation requirements and consider whether remedial events should be inserted before bottleneck events.`,
           grades.length
        );
      }
    }

    // Mark run complete
    await safeExec(db, `
      UPDATE "TIEAnalyticsRun"
      SET status='complete', "completedAt"=NOW(), "recordsProcessed"=$1
      WHERE id=$2
    `, pt051Records.length, runId);

    console.log(`✅ TIE analytics run complete: ${runId}, processed ${pt051Records.length} records`);
    return {
      success: true,
      runId,
      recordsProcessed: pt051Records.length,
      trainees: Object.keys(byTrainee).length,
      events: Object.keys(byEvent).length,
      courses: Object.keys(byCourse).length,
      atRiskTrainees: atRiskTrainees.length,
      exceedingTrainees: exceedingTrainees.length
    };

  } catch (err) {
    console.error('❌ TIE analytics error:', err);
    await safeExec(db, `UPDATE "TIEAnalyticsRun" SET status='failed', "completedAt"=NOW(), "errorMessage"=$1 WHERE id=$2`,
      err.message, runId);
    return { success: false, error: err.message, runId };
  }
}

module.exports = { ensureTIETables, seedTIEDefaults, runTIEAnalytics };