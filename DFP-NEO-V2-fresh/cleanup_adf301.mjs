import https from 'https';
import http from 'http';

const API_BASE = 'https://dfp-neo-v2-production.up.railway.app';

// Full BPC+IPC syllabus in ORDER (from mockData.ts lines 141-231)
const SYLLABUS_ORDER = [
  'BGF MB1', 'BGF MB2', 'BGF CPT1', 'BGF TUT1A', 'BGF TUT1B', 'BGF TUT2',
  'BGF MB3', 'BGF MB4', 'BGF MB5', 'BGF MB6', 'BGF CPT2', 'BGF FTD1',
  'BGF MB7', 'BGF1', 'BGF FTD2', 'BGF2', 'BGF MB8', 'BGF CPT3',
  'BGF MB9', 'BGF TUT3', 'BGF FTD3', 'BGF3', 'BGF FTD4', 'BGF4', 'BGF5',
  'BGF MB10', 'BGF MB11', 'BGF MB12', 'BGF CPT4', 'BGF6',
  'BGF MB13', 'BGF CPT5', 'BGF7', 'BGF FTD5', 'BGF8',
  'PERRT CPT1', 'BGF9', 'BGF MB14', 'BGF FTD6', 'BGF10', 'BGF11',
  'BGF MB15', 'BGF MB16', 'BGF FTD7', 'BGF12', 'BGF13', 'BGF14',
  'BGF FTD8', 'BGF15', 'BGF16', 'BGF TUT4', 'BGF FTD9', 'BGF17', 'BGF18',
  'BGF19', 'BGF20',
  // BIF phase
  'BIF MB1', 'BIF MB2', 'BIF TUT1', 'BIF CPT1', 'BIF CPT2',
  'BIF FTD1', 'BIF FTD2', 'BIF FTD3', 'BIF1', 'BIF2',
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
  // Group 1: target = BIF2 (idx 0-4)
  { id: 'cmk4usy8m002ti9wekuzgywyi', name: 'Brown, Charles',     target: 'BIF2' },
  { id: 'cmk4usybt002yi9wexywep7hv', name: 'Davies, Mary',       target: 'BIF2' },
  { id: 'cmk4usy4o002ni9weuelhwqjc', name: 'Edwards, Jennifer',  target: 'BIF2' },
  { id: 'cmk4usy0r002hi9wegrppdsxi', name: 'Evans, Olivia',      target: 'BIF2' },
  { id: 'cmk4usy23002ji9wes7808lks', name: 'Evans, Steven',      target: 'BIF2' },
  // Group 2: target = BIF3
  { id: 'cmk4usy2q002ki9wehtw10i96', name: 'Green, Ava',         target: 'BIF3' },
  { id: 'cmk4usy3d002li9we5hpdt561', name: 'Green, Barbara',     target: 'BIF3' },
  { id: 'cmk4usy78002ri9wejgr2c9jv', name: 'Harris, Noah',       target: 'BIF3' },
  { id: 'cmk4usy1g002ii9wef46wogwz', name: 'Hill, Mary',         target: 'BIF3' },
  { id: 'cmk4usy04002gi9wekvtdh0gq', name: 'King, Susan',        target: 'BIF3' },
  // Group 3: target = BNF FTD1
  { id: 'cmk4usxws002bi9we1hu9uqu1', name: 'Lee, Jessica',       target: 'BNF FTD1' },
  { id: 'cmk4usy9w002vi9we4twucpdi', name: 'Lee, Robert',        target: 'BNF FTD1' },
  { id: 'cmk4usy5y002pi9ween0zb1qr', name: 'Lewis, Lucas',       target: 'BNF FTD1' },
  { id: 'cmk4usxzh002fi9wevwxewjs6', name: 'Martin, Theodore',   target: 'BNF FTD1' },
  { id: 'cmk4usy41002mi9weinyqlhi8', name: 'Moore, Elijah',      target: 'BNF FTD1' },
  // Group 4: target = BNF1
  { id: 'cmk4usxy4002di9wezbj3rvh2', name: 'Parker, Jessica',    target: 'BNF1' },
  { id: 'cmk4usy6l002qi9wes5fcpf76', name: 'Roberts, Olivia',    target: 'BNF1' },
  { id: 'cmk4usxvi002ai9weztk927i2', name: 'Robinson, Lucas',    target: 'BNF1' },
  { id: 'cmk4usxyt002ei9wetf46rpjr', name: 'Robinson, Sarah',    target: 'BNF1' },
  { id: 'cmk4usyb6002xi9wevkfwhfmp', name: 'Smith, Michael',     target: 'BNF1' },
  // Group 5: target = BNF2
  { id: 'cmk4usy99002ui9web5nrupqf', name: 'Turner, Harper',     target: 'BNF2' },
  { id: 'cmk4usxxg002ci9we5tco5d54', name: 'Williams, David',    target: 'BNF2' },
  { id: 'cmk4usyaj002wi9wex2r9yfe8', name: 'Williams, Mary',     target: 'BNF2' },
  { id: 'cmk4usy5b002oi9wekg3cdi1p', name: 'Wright, Theodore',   target: 'BNF2' },
  { id: 'cmk4usy7z002si9we48b3ob5s', name: 'Wright, William',    target: 'BNF2' },
];

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    };
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// Get all events AFTER the target event in syllabus order
function getEventsAfterTarget(targetEvent, allTraineeEvents) {
  const targetIdx = SYLLABUS_ORDER.indexOf(targetEvent);
  if (targetIdx === -1) {
    console.error(`❌ Target event "${targetEvent}" not found in SYLLABUS_ORDER!`);
    return [];
  }
  // Events to DELETE = events that appear after targetIdx in syllabus
  const eventsAfter = new Set(SYLLABUS_ORDER.slice(targetIdx + 1));
  return allTraineeEvents.filter(ev => eventsAfter.has(ev));
}

async function deleteEventsForTrainee(traineeId, eventsToDelete) {
  const res = await fetchJSON(`${API_BASE}/api/scores/trainee/${traineeId}/events`, {
    method: 'DELETE',
    body: { events: eventsToDelete },
  });
  return res;
}

// GET /api/scores?traineeId=X - returns { scores: [[name, [events]]], count }
async function getScoresByTraineeId(traineeId) {
  const res = await fetchJSON(`${API_BASE}/api/scores?traineeId=${traineeId}`);
  if (res.status === 200 && res.body && Array.isArray(res.body.scores)) {
    // scores is [[fullName, [{ event, score, date }]], ...]
    const allEvents = [];
    for (const [, evList] of res.body.scores) {
      evList.forEach(e => allEvents.push(e.event));
    }
    return allEvents;
  }
  return null;
}

async function main() {
  console.log('🚀 ADF301 Cleanup Script - Spreading trainees across 5 target events');
  console.log('='.repeat(70));
  console.log('Target groups:');
  console.log('  BIF2     : Brown, Davies, Edwards, Evans (Olivia), Evans (Steven)');
  console.log('  BIF3     : Green (Ava), Green (Barbara), Harris, Hill, King');
  console.log('  BNF FTD1 : Lee (Jessica), Lee (Robert), Lewis, Martin, Moore');
  console.log('  BNF1     : Parker, Roberts, Robinson (Lucas), Robinson (Sarah), Smith');
  console.log('  BNF2     : Turner, Williams (David), Williams (Mary), Wright (Theodore), Wright (William)');
  console.log('='.repeat(70));

  // First, let's check what endpoint format is available for individual trainee scores
  console.log('\n🔍 Testing score endpoint format...');
  const testRes = await fetchJSON(`${API_BASE}/api/scores?traineeId=${TRAINEES[0].id}`);
  console.log(`  Status: ${testRes.status}`);
  if (testRes.status === 200 && testRes.body && testRes.body.scores) {
    const firstEntry = testRes.body.scores[0];
    if (firstEntry) {
      const [name, evList] = firstEntry;
      console.log(`  Trainee: ${name}, events count: ${evList.length}`);
      console.log(`  Sample events: ${evList.slice(0, 5).map(e => e.event).join(', ')}`);
    }
  } else {
    console.log(`  Body preview: ${JSON.stringify(testRes.body).slice(0, 300)}`);
  }

  console.log('\n📋 Processing each trainee...\n');

  let totalDeleted = 0;
  const results = [];

  for (const trainee of TRAINEES) {
    process.stdout.write(`  [${trainee.target.padEnd(10)}] ${trainee.name.padEnd(22)} `);
    
    // Get current events for this trainee
    const events = await getScoresByTraineeId(trainee.id);
    
    if (events === null) {
      console.log(`❌ Could not fetch scores`);
      results.push({ trainee: trainee.name, target: trainee.target, status: 'ERROR', deleted: 0 });
      continue;
    }

    const uniqueEvents = [...new Set(events)];
    
    // Determine which events to delete (everything after target)
    const toDelete = getEventsAfterTarget(trainee.target, uniqueEvents);
    
    if (toDelete.length === 0) {
      console.log(`✅ Nothing to delete (${uniqueEvents.length} events, all ≤ ${trainee.target})`);
      results.push({ trainee: trainee.name, target: trainee.target, status: 'CLEAN', deleted: 0 });
      continue;
    }

    // Delete the excess events
    const delRes = await deleteEventsForTrainee(trainee.id, toDelete);
    
    if (delRes.status === 200) {
      const deleted = delRes.body.deleted || toDelete.length;
      totalDeleted += deleted;
      console.log(`🗑️  Deleted ${deleted} records (${toDelete.slice(0,3).join(', ')}${toDelete.length > 3 ? `...+${toDelete.length-3}` : ''})`);
      results.push({ trainee: trainee.name, target: trainee.target, status: 'DELETED', deleted });
    } else {
      console.log(`❌ Delete failed: ${JSON.stringify(delRes.body).slice(0, 100)}`);
      results.push({ trainee: trainee.name, target: trainee.target, status: 'ERROR', deleted: 0 });
    }

    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ Complete! Total score records deleted: ${totalDeleted}`);
  console.log('\nSummary:');
  results.forEach(r => {
    const icon = r.status === 'DELETED' ? '🗑️ ' : r.status === 'CLEAN' ? '✅' : '❌';
    console.log(`  ${icon} ${r.trainee.padEnd(22)} → ${r.target.padEnd(10)} (deleted: ${r.deleted})`);
  });

  // Verify - check a few trainees to confirm cleanup
  console.log('\n🔍 Verification - checking a sample of trainees...');
  const samplesToCheck = [TRAINEES[0], TRAINEES[5], TRAINEES[10], TRAINEES[15], TRAINEES[20]];
  for (const t of samplesToCheck) {
    const events = await getScoresByTraineeId(t.id);
    if (events) {
      const uniqueEvents = [...new Set(events)];
      const targetIdx = SYLLABUS_ORDER.indexOf(t.target);
      const hasExcess = uniqueEvents.some(ev => {
        const idx = SYLLABUS_ORDER.indexOf(ev);
        return idx > targetIdx;
      });
      const eventsAtOrBefore = uniqueEvents.filter(ev => {
        const idx = SYLLABUS_ORDER.indexOf(ev);
        return idx !== -1 && idx <= targetIdx;
      });
      const eventsUnknown = uniqueEvents.filter(ev => SYLLABUS_ORDER.indexOf(ev) === -1);
      console.log(`  ${t.name.padEnd(22)} target=${t.target.padEnd(10)} remaining=${uniqueEvents.length} known=${eventsAtOrBefore.length} unknown=${eventsUnknown.length} excess=${hasExcess ? '⚠️ YES' : '✅ No'}`);
      if (eventsUnknown.length > 0) console.log(`    Unknown events: ${eventsUnknown.join(', ')}`);
    }
  }
}

main().catch(console.error);