import { execSync } from 'child_process';

const API_BASE = 'https://dfp-neo-v2-production.up.railway.app';

function curlGet(url) {
  const out = execSync(`curl -s "${url}"`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}
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

// Get real DB syllabus codes
const syl = curlGet(`${API_BASE}/api/syllabus`);
const DB_CODES = new Set(syl.syllabus.map(i => i.code));
console.log(`DB syllabus has ${DB_CODES.size} items`);

// All 25 ADF301 trainees with their targets
const TRAINEES = [
  { id: 'cmk4usy8m002ti9wekuzgywyi', name: 'Brown, Charles',     target: 'BIF2' },
  { id: 'cmk4usybt002yi9wexywep7hv', name: 'Davies, Mary',       target: 'BIF2' },
  { id: 'cmk4usy4o002ni9weuelhwqjc', name: 'Edwards, Jennifer',  target: 'BIF2' },
  { id: 'cmk4usy0r002hi9wegrppdsxi', name: 'Evans, Olivia',      target: 'BIF2' },
  { id: 'cmk4usy23002ji9wes7808lks', name: 'Evans, Steven',      target: 'BIF2' },
  { id: 'cmk4usy2q002ki9wehtw10i96', name: 'Green, Ava',         target: 'BIF3' },
  { id: 'cmk4usy3d002li9we5hpdt561', name: 'Green, Barbara',     target: 'BIF3' },
  { id: 'cmk4usy78002ri9wejgr2c9jv', name: 'Harris, Noah',       target: 'BIF3' },
  { id: 'cmk4usy1g002ii9wef46wogwz', name: 'Hill, Mary',         target: 'BIF3' },
  { id: 'cmk4usy04002gi9wekvtdh0gq', name: 'King, Susan',        target: 'BIF3' },
  { id: 'cmk4usxws002bi9we1hu9uqu1', name: 'Lee, Jessica',       target: 'BNF FTD1' },
  { id: 'cmk4usy9w002vi9we4twucpdi', name: 'Lee, Robert',        target: 'BNF FTD1' },
  { id: 'cmk4usy5y002pi9ween0zb1qr', name: 'Lewis, Lucas',       target: 'BNF FTD1' },
  { id: 'cmk4usxzh002fi9wevwxewjs6', name: 'Martin, Theodore',   target: 'BNF FTD1' },
  { id: 'cmk4usy41002mi9weinyqlhi8', name: 'Moore, Elijah',      target: 'BNF FTD1' },
  { id: 'cmk4usxy4002di9wezbj3rvh2', name: 'Parker, Jessica',    target: 'BNF1' },
  { id: 'cmk4usy6l002qi9wes5fcpf76', name: 'Roberts, Olivia',    target: 'BNF1' },
  { id: 'cmk4usxvi002ai9weztk927i2', name: 'Robinson, Lucas',    target: 'BIF3' },
  { id: 'cmk4usxyt002ei9wetf46rpjr', name: 'Robinson, Sarah',    target: 'BIF3' },
  { id: 'cmk4usyb6002xi9wevkfwhfmp', name: 'Smith, Michael',     target: 'BIF3' },
  { id: 'cmk4usy99002ui9web5nrupqf', name: 'Turner, Harper',     target: 'BNF2' },
  { id: 'cmk4usxxg002ci9we5tco5d54', name: 'Williams, David',    target: 'BIF3' },
  { id: 'cmk4usyaj002wi9wex2r9yfe8', name: 'Williams, Mary',     target: 'BIF3' },
  { id: 'cmk4usy5b002oi9wekg3cdi1p', name: 'Wright, Theodore',   target: 'BIF3' },
  { id: 'cmk4usy7z002si9we48b3ob5s', name: 'Wright, William',    target: 'BNF2' },
];

// DB syllabus order for target index checking
const syllabusOrder = syl.syllabus.sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0)).map(i => i.code);

console.log('\n🧹 Removing non-DB-syllabus score events from all 25 ADF301 trainees...\n');

let totalDeleted = 0;

for (const t of TRAINEES) {
  const scores = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evList = scores.scores[0][1];
  const allEvents = [...new Set(evList.map(e => e.event))];
  
  // Find events NOT in DB syllabus
  const nonDbEvents = allEvents.filter(ev => !DB_CODES.has(ev));
  
  if (nonDbEvents.length === 0) {
    console.log(`  ✅ ${t.name.padEnd(22)} → ${t.target} (no non-DB events)`);
    continue;
  }
  
  // Delete them
  const delRes = curlDelete(`${API_BASE}/api/scores/trainee/${t.id}/events`, { events: nonDbEvents });
  totalDeleted += delRes.deleted || 0;
  console.log(`  🗑️  ${t.name.padEnd(22)} → ${t.target} deleted ${delRes.deleted} non-DB events: [${nonDbEvents.join(', ')}]`);
}

console.log(`\nTotal non-DB events deleted: ${totalDeleted}`);

// Run LMP sync to rebuild completedEventIds cleanly
console.log('\n🔄 Running LMP sync...');
const syncRes = curlPost(`${API_BASE}/api/trainees/lmp-sync`, {});
console.log(`  Sync: created=${syncRes.summary.created} updated=${syncRes.summary.updated} unchanged=${syncRes.summary.unchanged}`);

// Final verification - check what next event the algorithm would pick for each trainee
console.log('\n🔍 Final verification - checking completedEventIds vs DB syllabus...\n');
const lmpData = curlGet(`${API_BASE}/api/trainees/lmp-sync`);
const lmpMap = {};
lmpData.lmps.forEach(l => { lmpMap[l.traineeId] = l; });

let passed = 0;
for (const t of TRAINEES) {
  const lmp = lmpMap[t.id];
  if (!lmp) { console.log(`  ❌ ${t.name} - no LMP`); continue; }
  
  const completedSet = new Set(lmp.completedEventIds);
  const targetIdx = syllabusOrder.indexOf(t.target);
  const targetDone = completedSet.has(t.target);
  
  // Check for any DB events beyond target in completedEventIds
  const excess = syllabusOrder.slice(targetIdx + 1).filter(c => completedSet.has(c));
  
  // Check for non-DB events in completedEventIds  
  const nonDb = lmp.completedEventIds.filter(e => !DB_CODES.has(e));
  
  const ok = targetDone && excess.length === 0 && nonDb.length === 0;
  if (ok) passed++;
  
  const icon = ok ? '✅' : '⚠️ ';
  if (ok) {
    console.log(`  ${icon} ${t.name.padEnd(22)} → ${t.target} (${lmp.completedEventIds.length} completed)`);
  } else {
    console.log(`  ${icon} ${t.name.padEnd(22)} → ${t.target} targetDone=${targetDone} excess=[${excess.join(',')}] nonDb=[${nonDb.slice(0,3).join(',')}]`);
  }
}
console.log(`\n${passed}/25 ✅ passed`);