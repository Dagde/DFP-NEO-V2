const pg = require('pg');
const { Client } = pg;

async function checkScheduleData() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    await client.connect();
    
    // Check Schedule table - any records at all?
    const countResult = await client.query(`SELECT COUNT(*) as count FROM "Schedule"`);
    console.log(`Schedule table: ${countResult.rows[0].count} records`);
    
    // Check if there's data with any content
    const nonNullResult = await client.query(`SELECT COUNT(*) as count FROM "Schedule" WHERE data IS NOT NULL`);
    console.log(`Schedule records with data: ${nonNullResult.rows[0].count}`);
    
    // Get a record if exists
    const sampleResult = await client.query(`SELECT id, "userId", date, data FROM "Schedule" LIMIT 1`);
    if (sampleResult.rows.length > 0) {
      const row = sampleResult.rows[0];
      console.log('\nSample schedule record:');
      console.log(`  id: ${row.id}`);
      console.log(`  userId: ${row.userId}`);
      console.log(`  date: ${row.date}`);
      console.log(`  data type: ${typeof row.data}`);
      if (row.data) {
        const dataStr = JSON.stringify(row.data);
        console.log(`  data (first 500 chars): ${dataStr.substring(0, 500)}`);
      }
    }
    
    // Also check if events are stored per-trainee in the Score table
    const scoreSample = await client.query(`
      SELECT s."traineeId", t.name, t.course, s.event, s.score, s.date
      FROM "Score" s
      JOIN "Trainee" t ON t.id = s."traineeId"
      WHERE t.course IN ('FIC 210', 'FIC211', 'ADF301', 'ADF302', 'ADF303', 'ADF304', 'ADF305')
      LIMIT 10
    `);
    console.log('\nSample Score records for BPC+IPC/FIC trainees:');
    scoreSample.rows.forEach(r => {
      console.log(`  ${r.name} (${r.course}): ${r.event} on ${r.date}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkScheduleData();
