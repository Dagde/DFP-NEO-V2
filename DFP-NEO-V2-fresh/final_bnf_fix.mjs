import { execSync } from 'child_process';

const API_BASE = 'https://dfp-neo-v2-production.up.railway.app';

function curlGet(url) {
  const out = execSync(`curl -s "${url}"`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}
function curlDelete(url, body) {
  const b = JSON.stringify(body).replace(/'/g, "'\\''");
  const out = execSync(`curl -s -X DELETE "${url}" -H "Content-Type: application/json" -d '${b}'`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}
function curlPost(url, body) {
  const b = JSON.stringify(body).replace(/'/g, "'\\''");
  const out = execSync(`curl -s -X POST "${url}" -H "Content-Type: application/json" -d '${b}'`, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(out);
}

// Get DB syllabus order
const syl = curlGet(`${API_BASE}/api/syllabus`);
const syllabusOrder = syl.syllabus.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(i=>i.code);
const DB_CODES = new Set(syl.syllabus.map(i => i.code));

console.log('=== FINAL BNF FIX ===\n');
console.log('Goal: 2 at BNF1 (Parker, Roberts), 2 at BNF2 (Turner, Wright William), rest at BIF3\n');

// Group 1: Turner and Wright William - currently at BNF3 next
// They have BNF1+BNF2 completed, need to DELETE BNF3 only (they're already at BNF2 target ✅)
// Wait - BNF3 next means BNF2 is their last completed = correct for BNF2 target
// Actually Turner/Wright William ARE correct for BNF2 - BNF3 is their next event
// So nothing to do for them!

// Group 2: Lee Jessica/Robert, Lewis, Martin, Moore - BNF1 is next (have BNF FTD1 done)
// These should be BIF3 targets → delete BNF FTD1 scores, ensure BIF3 score exists
const MOVE_TO_BIF3_FROM_BNFFTD1 = [
  { id: 'cmk4usxws002bi9we1hu9uqu1', name: 'Lee, Jessica' },
  { id: 'cmk4usy9w002vi9we4twucpdi', name: 'Lee, Robert' },
  { id: 'cmk4usy5y002pi9ween0zb1qr', name: 'Lewis, Lucas' },
  { id: 'cmk4usxzh002fi9wevwxewjs6', name: 'Martin, Theodore' },
  { id: 'cmk4usy41002mi9weinyqlhi8', name: 'Moore, Elijah' },
];

// Group 3: BIF3 group that has BNF MB1 as next (means BIF3 is completed ✅ but BNF MB1 is ground)
// These are CORRECT - BIF3 is their last event, BNF MB1 is ground school (skipped by algorithm)
// So their actual schedulable next flight event after BNF MB1 is BNF FTD1
// These all need to stay at BIF3 target - but BNF FTD1 would be their next FLIGHT event!
// We need to ensure they DON'T have BNF MB1 in scores so BNF MB1 stays incomplete
// Actually BNF MB1 being ground school - the build algorithm skips MB events:
// line: if (completedEventIds.has(item.id) || completedEventIds.has(item.code) || item.code.includes(' MB'))
// So BNF MB1 is SKIPPED! Their actual next schedulable = BNF FTD1
// THAT is why so many appear at BNF FTD1/BNF1/BNF2 in the schedule
// Fix: BIF3 group should NOT have BNF FTD1 in their completedEventIds
// Current BIF3 completedEventIds should end at BIF3 (no BNF events)

// Let me check what BNF events BIF3 group currently has in scores
console.log('Checking BIF3 group scores for BNF events...\n');
const BIF3_GROUP = [
  { id: 'cmk4usy2q002ki9wehtw10i96', name: 'Green, Ava' },
  { id: 'cmk4usy3d002li9we5hpdt561', name: 'Green, Barbara' },
  { id: 'cmk4usy78002ri9wejgr2c9jv', name: 'Harris, Noah' },
  { id: 'cmk4usy1g002ii9wef46wogwz', name: 'Hill, Mary' },
  { id: 'cmk4usy04002gi9wekvtdh0gq', name: 'King, Susan' },
  { id: 'cmk4usxvi002ai9weztk927i2', name: 'Robinson, Lucas' },
  { id: 'cmk4usxyt002ei9wetf46rpjr', name: 'Robinson, Sarah' },
  { id: 'cmk4usyb6002xi9wevkfwhfmp', name: 'Smith, Michael' },
  { id: 'cmk4usxxg002ci9we5tco5d54', name: 'Williams, David' },
  { id: 'cmk4usyaj002wi9wex2r9yfe8', name: 'Williams, Mary' },
  { id: 'cmk4usy5b002oi9wekg3cdi1p', name: 'Wright, Theodore' },
];

// Events to delete to bring to BIF3: all BNF events + anything after BIF3 in DB
const AFTER_BIF3 = syllabusOrder.slice(syllabusOrder.indexOf('BIF3') + 1); // everything after BIF3
const AFTER_BIF3_SET = new Set(AFTER_BIF3);

let totalDeleted = 0;

console.log('--- Step 1: Fix BIF3 group (remove any BNF/post-BIF3 scores) ---');
for (const t of BIF3_GROUP) {
  const scores = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evList = scores.scores[0][1];
  const allEvents = [...new Set(evList.map(e => e.event))];
  const toDelete = allEvents.filter(ev => AFTER_BIF3_SET.has(ev));
  if (toDelete.length === 0) {
    console.log(`  ✅ ${t.name.padEnd(22)} - no post-BIF3 events`);
    continue;
  }
  const delRes = curlDelete(`${API_BASE}/api/scores/trainee/${t.id}/events`, { events: toDelete });
  totalDeleted += delRes.deleted || 0;
  console.log(`  🗑️  ${t.name.padEnd(22)} deleted ${delRes.deleted}: [${toDelete.join(', ')}]`);
}

console.log('\n--- Step 2: Move Lee/Lewis/Martin/Moore from BNF FTD1 target → BIF3 ---');
const BNF_EVENTS_TO_DELETE = ['BNF MB1', 'BNF FTD1', 'BNF1', 'BNF2', 'BNF3', 'BNF4'];
for (const t of MOVE_TO_BIF3_FROM_BNFFTD1) {
  // Delete all BNF events
  const scores = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evList = scores.scores[0][1];
  const allEvents = [...new Set(evList.map(e => e.event))];
  const toDelete = allEvents.filter(ev => BNF_EVENTS_TO_DELETE.includes(ev) || AFTER_BIF3_SET.has(ev));
  
  if (toDelete.length > 0) {
    const delRes = curlDelete(`${API_BASE}/api/scores/trainee/${t.id}/events`, { events: toDelete });
    totalDeleted += delRes.deleted || 0;
    console.log(`  🗑️  ${t.name.padEnd(22)} deleted ${delRes.deleted}: [${toDelete.join(', ')}]`);
  }
  
  // Ensure BIF3 exists
  const scoresAfter = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evAfter = new Set(scoresAfter.scores[0][1].map(e => e.event));
  if (!evAfter.has('BIF3')) {
    curlPost(`${API_BASE}/api/scores`, { traineeId: t.id, event: 'BIF3', score: 75, date: '2024-08-15' });
    console.log(`  ✅ ${t.name.padEnd(22)} added BIF3 score`);
  } else {
    console.log(`  ✅ ${t.name.padEnd(22)} BIF3 already present`);
  }
}

console.log('\n--- Step 3: Turner and Wright William - check BNF2 target (remove BNF3 if present) ---');
const BNF2_KEEP = [
  { id: 'cmk4usy99002ui9web5nrupqf', name: 'Turner, Harper' },
  { id: 'cmk4usy7z002si9we48b3ob5s', name: 'Wright, William' },
];
for (const t of BNF2_KEEP) {
  const scores = curlGet(`${API_BASE}/api/scores?traineeId=${t.id}`);
  const evList = scores.scores[0][1];
  const allEvents = [...new Set(evList.map(e => e.event))];
  const toDelete = allEvents.filter(ev => {
    const idx = syllabusOrder.indexOf(ev);
    return idx !== -1 && idx > syllabusOrder.indexOf('BNF2');
  });
  if (toDelete.length > 0) {
    const delRes = curlDelete(`${API_BASE}/api/scores/trainee/${t.id}/events`, { events: toDelete });
    totalDeleted += delRes.deleted || 0;
    console.log(`  🗑️  ${t.name.padEnd(22)} deleted ${delRes.deleted}: [${toDelete.join(', ')}]`);
  } else {
    console.log(`  ✅ ${t.name.padEnd(22)} BNF2 already clean`);
  }
}

console.log(`\nTotal deleted: ${totalDeleted}`);

// LMP Sync
console.log('\n🔄 Running LMP sync...');
const syncRes = curlPost(`${API_BASE}/api/trainees/lmp-sync`, {});
console.log(`  Sync: updated=${syncRes.summary.updated} unchanged=${syncRes.summary.unchanged}`);

// Final check
console.log('\n🔍 Final next-event check for all 25 ADF301 trainees...\n');
const lmpData = curlGet(`${API_BASE}/api/trainees/lmp-sync`);
const lmpMap = {};
lmpData.lmps.forEach(l => { lmpMap[l.traineeId] = l; });

const ALL_25 = [
  {id:'cmk4usy8m002ti9wekuzgywyi',name:'Brown, Charles'},
  {id:'cmk4usybt002yi9wexywep7hv',name:'Davies, Mary'},
  {id:'cmk4usy4o002ni9weuelhwqjc',name:'Edwards, Jennifer'},
  {id:'cmk4usy0r002hi9wegrppdsxi',name:'Evans, Olivia'},
  {id:'cmk4usy23002ji9wes7808lks',name:'Evans, Steven'},
  {id:'cmk4usy2q002ki9wehtw10i96',name:'Green, Ava'},
  {id:'cmk4usy3d002li9we5hpdt561',name:'Green, Barbara'},
  {id:'cmk4usy78002ri9wejgr2c9jv',name:'Harris, Noah'},
  {id:'cmk4usy1g002ii9wef46wogwz',name:'Hill, Mary'},
  {id:'cmk4usy04002gi9wekvtdh0gq',name:'King, Susan'},
  {id:'cmk4usxws002bi9we1hu9uqu1',name:'Lee, Jessica'},
  {id:'cmk4usy9w002vi9we4twucpdi',name:'Lee, Robert'},
  {id:'cmk4usy5y002pi9ween0zb1qr',name:'Lewis, Lucas'},
  {id:'cmk4usxzh002fi9wevwxewjs6',name:'Martin, Theodore'},
  {id:'cmk4usy41002mi9weinyqlhi8',name:'Moore, Elijah'},
  {id:'cmk4usxy4002di9wezbj3rvh2',name:'Parker, Jessica'},
  {id:'cmk4usy6l002qi9wes5fcpf76',name:'Roberts, Olivia'},
  {id:'cmk4usxvi002ai9weztk927i2',name:'Robinson, Lucas'},
  {id:'cmk4usxyt002ei9wetf46rpjr',name:'Robinson, Sarah'},
  {id:'cmk4usyb6002xi9wevkfwhfmp',name:'Smith, Michael'},
  {id:'cmk4usy99002ui9web5nrupqf',name:'Turner, Harper'},
  {id:'cmk4usxxg002ci9we5tco5d54',name:'Williams, David'},
  {id:'cmk4usyaj002wi9wex2r9yfe8',name:'Williams, Mary'},
  {id:'cmk4usy5b002oi9wekg3cdi1p',name:'Wright, Theodore'},
  {id:'cmk4usy7z002si9we48b3ob5s',name:'Wright, William'},
];

const counts = { BIF3: 0, BNF_MB1: 0, BNF_FTD1: 0, BNF1: 0, BNF2: 0, BNF3: 0, other: 0 };
for (const t of ALL_25) {
  const lmp = lmpMap[t.id];
  if (!lmp) { console.log(`  ❌ ${t.name} - no LMP`); continue; }
  const completedSet = new Set(lmp.completedEventIds);
  let nextEvent = 'NONE';
  for (const code of syllabusOrder) {
    if (!completedSet.has(code)) { nextEvent = code; break; }
  }
  const icon = nextEvent === 'BIF3' ? '🎯' : nextEvent === 'BNF FTD1' ? '🌙' : nextEvent === 'BNF1' ? '🌙' : nextEvent === 'BNF2' ? '🌙' : nextEvent === 'BNF3' ? '❌' : nextEvent === 'BNF MB1' ? '📚' : '✅';
  console.log(`  ${icon} ${t.name.padEnd(22)} nextEvent=${nextEvent}`);
  if (nextEvent === 'BIF3') counts.BIF3++;
  else if (nextEvent === 'BNF MB1') counts.BNF_MB1++;
  else if (nextEvent === 'BNF FTD1') counts.BNF_FTD1++;
  else if (nextEvent === 'BNF1') counts.BNF1++;
  else if (nextEvent === 'BNF2') counts.BNF2++;
  else if (nextEvent === 'BNF3') counts.BNF3++;
  else counts.other++;
}
console.log('\nSummary:');
Object.entries(counts).forEach(([k,v]) => { if(v>0) console.log(`  ${k}: ${v} trainees`); });