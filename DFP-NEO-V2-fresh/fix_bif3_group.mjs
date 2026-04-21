import { execSync } from 'child_process';

const API_BASE = 'https://dfp-neo-v2-production.up.railway.app';

// 4 BIF3 trainees missing the actual BIF3 score record
const TRAINEES = [
  { id: 'cmk4usy2q002ki9wehtw10i96', name: 'Green, Ava' },
  { id: 'cmk4usy3d002li9we5hpdt561', name: 'Green, Barbara' },
  { id: 'cmk4usy78002ri9wejgr2c9jv', name: 'Harris, Noah' },
  { id: 'cmk4usy1g002ii9wef46wogwz', name: 'Hill, Mary' },
];

// Events to DELETE: non-DB mock BIF events that are beyond BIF2 but aren't BIF3
// DB syllabus only has: BIF MB1, BIF CPT1, BIF FTD1, BIF1, BIF2, BIF3
// Everything else is mock-only
const EXCESS_EVENTS = [
  'BIF MB2', 'BIF TUT1', 'BIF CPT2', 'BIF FTD2', 'BIF FTD3',
  'BIF FTD1*', 'BIF FTD3*',
  'BIF MB3', 'BIF MB4', 'BIF MB5', 'BIF TUT2', 'BIF CPT3',
  'BIF FTD4', 'BIF FTD5', 'BIF FTD6'
];

function curlDelete(url, body) {
  const bodyStr = JSON.stringify(body);
  const out = execSync(
    `curl -s -X DELETE "${url}" -H "Content-Type: application/json" -d '${bodyStr.replace(/'/g, "'\\''")}'`,
    { encoding: 'utf8', timeout: 30000 }
  );
  return JSON.parse(out);
}

function curlPost(url, body) {
  const bodyStr = JSON.stringify(body);
  const out = execSync(
    `curl -s -X POST "${url}" -H "Content-Type: application/json" -d '${bodyStr.replace(/'/g, "'\\''")}'`,
    { encoding: 'utf8', timeout: 30000 }
  );
  return JSON.parse(out);
}

function curlGet(url) {
  const out = execSync(`curl -s "${url}"`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}

console.log('🔧 Fixing BIF3 group - 4 trainees missing BIF3 score\n');

for (const t of TRAINEES) {
  console.log(`Processing: ${t.name}`);
  
  // Step 1: Delete excess mock BIF events (not in DB syllabus)
  const delRes = curlDelete(`${API_BASE}/api/scores/trainee/${t.id}/events`, { events: EXCESS_EVENTS });
  console.log(`  ✅ Deleted ${delRes.deleted} excess mock BIF events`);
  
  // Step 2: Add BIF3 score record
  const addRes = curlPost(`${API_BASE}/api/scores`, {
    traineeId: t.id,
    event: 'BIF3',
    score: 75,
    date: '2024-08-15'
  });
  console.log(`  ✅ Added BIF3 score: ${addRes.success ? 'OK' : JSON.stringify(addRes)}`);
  
  // Step 3: Verify current scores
  const scores = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evList = scores.scores[0][1];
  const uniqueEvents = [...new Set(evList.map(e => e.event))];
  const bifEvents = uniqueEvents.filter(e => e.startsWith('BIF'));
  console.log(`  BIF events now: ${bifEvents.join(', ')}`);
  console.log('');
}

// Run LMP sync
console.log('🔄 Running LMP sync...');
const syncRes = curlPost(`${API_BASE}/api/trainees/lmp-sync`, {});
console.log(`  Sync result: created=${syncRes.summary.created} updated=${syncRes.summary.updated} unchanged=${syncRes.summary.unchanged}`);

// Show BIF3 group results from sync
const bif3Names = ['Green, Ava', 'Green, Barbara', 'Harris, Noah', 'Hill, Mary', 'King, Susan'];
console.log('\n  BIF3 group LMP sync results:');
syncRes.results
  .filter(r => bif3Names.some(n => r.traineeFullName.includes(n.split(',')[0])))
  .forEach(r => console.log(`    ${r.traineeFullName}: completedCount=${r.completedCount} status=${r.status}`));

console.log('\n✅ Done!');