import { execSync } from 'child_process';

const API_BASE = 'https://dfp-neo-v2-production.up.railway.app';

// Full BPC+IPC syllabus in ORDER (from mockData.ts)
// Includes actual DB event names (with asterisks and quiz events)
const SYLLABUS_ORDER = [
  'BGF MB1', 'BGF MB2', 'BGF CPT1', 'BGF TUT1A', 'BGF TUT1B', 'BGF TUT2',
  'BGF MB3', 'BGF MB4', 'BGF MB5', 'BGF MB6', 'BGF CPT2', 'BGF FTD1',
  'BGF MB7', 'BGF1', 'BGF FTD2', 'BGF2', 'BGF MB8', 'BGF CPT3',
  'BGF MB9', 'BGF TUT3', 'BGF FTD3', 'BGF3', 'BGF FTD4', 'BGF4', 'BGF5',
  'BGF MB10', 'BGF MB11', 'BGF MB12', 'BGF CPT4', 'BGF6',
  'BGF MB13', 'BGF CPT5', 'BGF7', 'BGF FTD5', 'BGF8',
  'PERRT CPT1', 'BGF9', 'BGF MB14', 'BGF FTD6', 'BGF10',
  'PRE-SOLO QUIZ',   // quiz before solo
  'BGF11',
  'BGF MB15', 'BGF MB16', 'BGF FTD7', 'BGF12', 'BGF13', 'BGF14',
  'BGF FTD8', 'BGF15', 'BGF16', 'BGF TUT4', 'BGF FTD9', 'BGF17',
  'AREA SOLO QUIZ',  // quiz before area solo
  'BGF18',
  'BGF19', 'BGF20',
  // BIF phase
  'BIF MB1', 'BIF MB2', 'BIF TUT1', 'BIF CPT1', 'BIF CPT2',
  'BIF FTD1', 'BIF FTD1*',   // both variants
  'BIF FTD2',
  'BIF FTD3', 'BIF FTD3*',   // both variants
  'BIF1', 'BIF2',
  // BNF phase
  'BNF MB1', 'BNF FTD1', 'BNF1', 'BNF2', 'BNF3', 'BNF4',
  // BIF continued
  'BIF MB3', 'BIF MB4', 'BIF MB5', 'BIF TUT2', 'BIF CPT3',
  'BIF FTD4', 'BIF FTD5', 'BIF FTD6', 'BIF3', 'BIF4', 'BIF5',
  // BGF advanced
  'BGF MB17', 'BGF FTD10', 'BGF21', 'BGF22', 'BGF23', 'BGF24',
];

// 25 ADF301 trainees - assign 5 to each target event
const TRAINEES = [
  // Group 1: target = BIF2 (5 trainees)
  { id: 'cmk4usy8m002ti9wekuzgywyi', name: 'Brown, Charles',     target: 'BIF2' },
  { id: 'cmk4usybt002yi9wexywep7hv', name: 'Davies, Mary',       target: 'BIF2' },
  { id: 'cmk4usy4o002ni9weuelhwqjc', name: 'Edwards, Jennifer',  target: 'BIF2' },
  { id: 'cmk4usy0r002hi9wegrppdsxi', name: 'Evans, Olivia',      target: 'BIF2' },
  { id: 'cmk4usy23002ji9wes7808lks', name: 'Evans, Steven',      target: 'BIF2' },
  // Group 2: target = BIF3 (5 trainees)
  { id: 'cmk4usy2q002ki9wehtw10i96', name: 'Green, Ava',         target: 'BIF3' },
  { id: 'cmk4usy3d002li9we5hpdt561', name: 'Green, Barbara',     target: 'BIF3' },
  { id: 'cmk4usy78002ri9wejgr2c9jv', name: 'Harris, Noah',       target: 'BIF3' },
  { id: 'cmk4usy1g002ii9wef46wogwz', name: 'Hill, Mary',         target: 'BIF3' },
  { id: 'cmk4usy04002gi9wekvtdh0gq', name: 'King, Susan',        target: 'BIF3' },
  // Group 3: target = BNF FTD1 (5 trainees)
  { id: 'cmk4usxws002bi9we1hu9uqu1', name: 'Lee, Jessica',       target: 'BNF FTD1' },
  { id: 'cmk4usy9w002vi9we4twucpdi', name: 'Lee, Robert',        target: 'BNF FTD1' },
  { id: 'cmk4usy5y002pi9ween0zb1qr', name: 'Lewis, Lucas',       target: 'BNF FTD1' },
  { id: 'cmk4usxzh002fi9wevwxewjs6', name: 'Martin, Theodore',   target: 'BNF FTD1' },
  { id: 'cmk4usy41002mi9weinyqlhi8', name: 'Moore, Elijah',      target: 'BNF FTD1' },
  // Group 4: target = BNF1 (5 trainees)
  { id: 'cmk4usxy4002di9wezbj3rvh2', name: 'Parker, Jessica',    target: 'BNF1' },
  { id: 'cmk4usy6l002qi9wes5fcpf76', name: 'Roberts, Olivia',    target: 'BNF1' },
  { id: 'cmk4usxvi002ai9weztk927i2', name: 'Robinson, Lucas',    target: 'BNF1' },
  { id: 'cmk4usxyt002ei9wetf46rpjr', name: 'Robinson, Sarah',    target: 'BNF1' },
  { id: 'cmk4usyb6002xi9wevkfwhfmp', name: 'Smith, Michael',     target: 'BNF1' },
  // Group 5: target = BNF2 (5 trainees)
  { id: 'cmk4usy99002ui9web5nrupqf', name: 'Turner, Harper',     target: 'BNF2' },
  { id: 'cmk4usxxg002ci9we5tco5d54', name: 'Williams, David',    target: 'BNF2' },
  { id: 'cmk4usyaj002wi9wex2r9yfe8', name: 'Williams, Mary',     target: 'BNF2' },
  { id: 'cmk4usy5b002oi9wekg3cdi1p', name: 'Wright, Theodore',   target: 'BNF2' },
  { id: 'cmk4usy7z002si9we48b3ob5s', name: 'Wright, William',    target: 'BNF2' },
];

function curlGet(url) {
  const out = execSync(`curl -s "${url}"`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}

function curlDelete(url, body) {
  const bodyJson = JSON.stringify(body).replace(/'/g, "'\\''");
  const out = execSync(
    `curl -s -X DELETE "${url}" -H "Content-Type: application/json" -d '${bodyJson}'`,
    { encoding: 'utf8', timeout: 30000 }
  );
  return JSON.parse(out);
}

function getEventsAfterTarget(targetEvent, allTraineeEvents) {
  const targetIdx = SYLLABUS_ORDER.indexOf(targetEvent);
  if (targetIdx === -1) {
    console.error(`❌ Target event "${targetEvent}" not found in SYLLABUS_ORDER!`);
    return [];
  }
  const eventsAfter = new Set(SYLLABUS_ORDER.slice(targetIdx + 1));
  return allTraineeEvents.filter(ev => eventsAfter.has(ev));
}

function getScoresByTraineeId(traineeId) {
  const data = curlGet(`${API_BASE}/api/scores?traineeId=${traineeId}`);
  if (data && Array.isArray(data.scores)) {
    const allEvents = [];
    for (const [, evList] of data.scores) {
      evList.forEach(e => allEvents.push(e.event));
    }
    return allEvents;
  }
  return null;
}

// Main
console.log('🚀 ADF301 Cleanup Script v2 - Using curl for reliable HTTP');
console.log('='.repeat(70));
console.log('Target groups:');
console.log('  BIF2     : Brown, Davies, Edwards, Evans (Olivia), Evans (Steven)');
console.log('  BIF3     : Green (Ava), Green (Barbara), Harris, Hill, King');
console.log('  BNF FTD1 : Lee (Jessica), Lee (Robert), Lewis, Martin, Moore');
console.log('  BNF1     : Parker, Roberts, Robinson (Lucas), Robinson (Sarah), Smith');
console.log('  BNF2     : Turner, Williams (David), Williams (Mary), Wright (Theodore), Wright (William)');
console.log('='.repeat(70));

// Quick sanity check on syllabus order for our targets
for (const target of ['BIF2', 'BIF3', 'BNF FTD1', 'BNF1', 'BNF2']) {
  const idx = SYLLABUS_ORDER.indexOf(target);
  console.log(`  ${target.padEnd(12)} → syllabus index ${idx}`);
}
console.log('');

console.log('📋 Processing each trainee...\n');

let totalDeleted = 0;
const results = [];

for (const trainee of TRAINEES) {
  process.stdout.write(`  [${trainee.target.padEnd(10)}] ${trainee.name.padEnd(22)} `);

  const events = getScoresByTraineeId(trainee.id);
  if (events === null) {
    console.log(`❌ Could not fetch scores`);
    results.push({ ...trainee, status: 'ERROR', deleted: 0 });
    continue;
  }

  const uniqueEvents = [...new Set(events)];
  const toDelete = getEventsAfterTarget(trainee.target, uniqueEvents);

  if (toDelete.length === 0) {
    console.log(`✅ Nothing to delete (${uniqueEvents.length} unique events, all ≤ ${trainee.target})`);
    results.push({ ...trainee, status: 'CLEAN', deleted: 0 });
    continue;
  }

  try {
    const delRes = curlDelete(
      `${API_BASE}/api/scores/trainee/${trainee.id}/events`,
      { events: toDelete }
    );
    const deleted = delRes.deleted || toDelete.length;
    totalDeleted += deleted;
    console.log(`🗑️  Deleted ${deleted} records (${toDelete.slice(0,4).join(', ')}${toDelete.length > 4 ? `...+${toDelete.length-4}` : ''})`);
    results.push({ ...trainee, status: 'DELETED', deleted });
  } catch (err) {
    console.log(`❌ Delete failed: ${err.message}`);
    results.push({ ...trainee, status: 'ERROR', deleted: 0 });
  }
}

console.log('\n' + '='.repeat(70));
console.log(`✅ Complete! Total score records deleted: ${totalDeleted}`);
console.log('\nSummary by group:');
const groups = ['BIF2','BIF3','BNF FTD1','BNF1','BNF2'];
for (const g of groups) {
  const gResults = results.filter(r => r.target === g);
  const totalDel = gResults.reduce((sum,r) => sum+r.deleted, 0);
  const errors = gResults.filter(r => r.status === 'ERROR').length;
  console.log(`  ${g.padEnd(12)}: ${gResults.length} trainees, ${totalDel} records deleted${errors ? `, ⚠️ ${errors} errors` : ''}`);
}

// Verification pass
console.log('\n🔍 Verification - checking all 25 trainees post-cleanup...\n');
let verifyPassed = 0;
let verifyFailed = 0;

for (const trainee of TRAINEES) {
  const events = getScoresByTraineeId(trainee.id);
  if (!events) {
    console.log(`  ❌ ${trainee.name} - could not verify`);
    verifyFailed++;
    continue;
  }
  const uniqueEvents = [...new Set(events)];
  const targetIdx = SYLLABUS_ORDER.indexOf(trainee.target);
  const excessEvents = uniqueEvents.filter(ev => {
    const idx = SYLLABUS_ORDER.indexOf(ev);
    return idx !== -1 && idx > targetIdx;
  });
  const unknownEvents = uniqueEvents.filter(ev => SYLLABUS_ORDER.indexOf(ev) === -1);

  if (excessEvents.length === 0 && unknownEvents.length === 0) {
    console.log(`  ✅ ${trainee.name.padEnd(22)} → ${trainee.target.padEnd(10)} (${uniqueEvents.length} events)`);
    verifyPassed++;
  } else {
    console.log(`  ⚠️  ${trainee.name.padEnd(22)} → ${trainee.target.padEnd(10)} EXCESS: [${excessEvents.join(', ')}] UNKNOWN: [${unknownEvents.join(', ')}]`);
    verifyFailed++;
  }
}

console.log(`\n✅ Verification: ${verifyPassed}/25 passed, ${verifyFailed} need attention`);