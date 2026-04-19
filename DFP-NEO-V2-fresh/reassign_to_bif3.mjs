import { execSync } from 'child_process';

const API_BASE = 'https://dfp-neo-v2-production.up.railway.app';

// 6 trainees moving from BNF1/BNF2 → BIF3
const TRAINEES = [
  { id: 'cmk4usxvi002ai9weztk927i2', name: 'Robinson, Lucas',   wasTarget: 'BNF1' },
  { id: 'cmk4usxyt002ei9wetf46rpjr', name: 'Robinson, Sarah',   wasTarget: 'BNF1' },
  { id: 'cmk4usyb6002xi9wevkfwhfmp', name: 'Smith, Michael',    wasTarget: 'BNF1' },
  { id: 'cmk4usxxg002ci9we5tco5d54', name: 'Williams, David',   wasTarget: 'BNF2' },
  { id: 'cmk4usyaj002wi9wex2r9yfe8', name: 'Williams, Mary',    wasTarget: 'BNF2' },
  { id: 'cmk4usy5b002oi9wekg3cdi1p', name: 'Wright, Theodore',  wasTarget: 'BNF2' },
];

// Events to delete: BNF1 and BNF2 (and BNF MB1, BNF FTD1 if present - these are after BIF3 in DB)
// DB syllabus after BIF3: BNF MB1(670), BNF FTD1(680), BNF1(690), BNF2(700), BNF3(710), BNAV...
const EVENTS_TO_DELETE = ['BNF MB1', 'BNF FTD1', 'BNF1', 'BNF2', 'BNF3'];

function curlDelete(url, body) {
  const bodyStr = JSON.stringify(body).replace(/'/g, "'\\''");
  const out = execSync(`curl -s -X DELETE "${url}" -H "Content-Type: application/json" -d '${bodyStr}'`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}

function curlPost(url, body) {
  const bodyStr = JSON.stringify(body).replace(/'/g, "'\\''");
  const out = execSync(`curl -s -X POST "${url}" -H "Content-Type: application/json" -d '${bodyStr}'`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}

function curlGet(url) {
  const out = execSync(`curl -s "${url}"`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}

console.log('🔄 Reassigning 6 trainees from BNF1/BNF2 → BIF3\n');

for (const t of TRAINEES) {
  console.log(`Processing: ${t.name} (was ${t.wasTarget} → now BIF3)`);

  // Step 1: Delete BNF events (all events after BIF3 in DB syllabus)
  const delRes = curlDelete(`${API_BASE}/api/scores/trainee/${t.id}/events`, { events: EVENTS_TO_DELETE });
  console.log(`  🗑️  Deleted ${delRes.deleted} BNF records`);

  // Step 2: Ensure BIF3 score exists
  const scores = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evList = scores.scores[0][1];
  const uniqueEvents = new Set(evList.map(e => e.event));
  
  if (!uniqueEvents.has('BIF3')) {
    const addRes = curlPost(`${API_BASE}/api/scores`, {
      traineeId: t.id,
      event: 'BIF3',
      score: 75,
      date: '2024-08-15'
    });
    console.log(`  ✅ Added BIF3 score: ${addRes.success ? 'OK' : JSON.stringify(addRes)}`);
  } else {
    console.log(`  ✅ BIF3 already present`);
  }

  // Verify
  const scoresAfter = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evAfter = [...new Set(scoresAfter.scores[0][1].map(e => e.event))];
  const bnfEvents = evAfter.filter(e => e.startsWith('BNF'));
  const bifEvents = evAfter.filter(e => e.startsWith('BIF'));
  console.log(`  BIF now: ${bifEvents.join(', ')}`);
  console.log(`  BNF now: ${bnfEvents.length === 0 ? 'NONE ✅' : bnfEvents.join(', ')}`);
  console.log('');
}

// Run LMP sync
console.log('🔄 Running LMP sync...');
const syncRes = curlPost(`${API_BASE}/api/trainees/lmp-sync`, {});
console.log(`  Sync: created=${syncRes.summary.created} updated=${syncRes.summary.updated} unchanged=${syncRes.summary.unchanged}\n`);

// Final verification using DB syllabus
console.log('🔍 Final verification for all affected trainees...\n');
const syl = curlGet(`${API_BASE}/api/syllabus`);
const syllabusOrder = syl.syllabus.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(i=>i.code);

const ALL_TARGETS = [
  // BNF1 keepers
  { id: 'cmk4usxy4002di9wezbj3rvh2', name: 'Parker, Jessica',   target: 'BNF1' },
  { id: 'cmk4usy6l002qi9wes5fcpf76', name: 'Roberts, Olivia',   target: 'BNF1' },
  // BNF2 keepers
  { id: 'cmk4usy99002ui9web5nrupqf', name: 'Turner, Harper',    target: 'BNF2' },
  { id: 'cmk4usy7z002si9we48b3ob5s', name: 'Wright, William',   target: 'BNF2' },
  // Moving to BIF3
  { id: 'cmk4usxvi002ai9weztk927i2', name: 'Robinson, Lucas',   target: 'BIF3' },
  { id: 'cmk4usxyt002ei9wetf46rpjr', name: 'Robinson, Sarah',   target: 'BIF3' },
  { id: 'cmk4usyb6002xi9wevkfwhfmp', name: 'Smith, Michael',    target: 'BIF3' },
  { id: 'cmk4usxxg002ci9we5tco5d54', name: 'Williams, David',   target: 'BIF3' },
  { id: 'cmk4usyaj002wi9wex2r9yfe8', name: 'Williams, Mary',    target: 'BIF3' },
  { id: 'cmk4usy5b002oi9wekg3cdi1p', name: 'Wright, Theodore',  target: 'BIF3' },
];

let passed = 0;
for (const t of ALL_TARGETS) {
  const scores = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const uniqueEvents = new Set(scores.scores[0][1].map(e => e.event));
  const targetIdx = syllabusOrder.indexOf(t.target);
  const targetDone = uniqueEvents.has(t.target);
  const excess = syllabusOrder.slice(targetIdx + 1).filter(c => uniqueEvents.has(c));
  const ok = targetDone && excess.length === 0;
  if (ok) passed++;
  const icon = ok ? '✅' : '⚠️ ';
  if (ok) console.log(`${icon} ${t.name.padEnd(22)} → ${t.target}`);
  else console.log(`${icon} ${t.name.padEnd(22)} target=${t.target} targetDone=${targetDone} excess=[${excess.join(',')}]`);
}
console.log(`\n${passed}/10 ✅ passed`);