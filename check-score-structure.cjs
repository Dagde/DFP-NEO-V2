const pg = require('pg');
const { Client } = pg;

async function checkScoreStructure() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    await client.connect();
    
    // Get Score table columns
    const colResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Score'
      ORDER BY ordinal_position
    `);
    console.log('Score table columns:');
    colResult.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // Sample Score records
    const sampleResult = await client.query(`SELECT * FROM "Score" LIMIT 5`);
    console.log('\nSample Score records:');
    sampleResult.rows.forEach(r => console.log(JSON.stringify(r)));

    // Get distinct types
    const typesResult = await client.query(`SELECT DISTINCT type FROM "Score" LIMIT 20`);
    console.log('\nDistinct Score types:');
    typesResult.rows.forEach(r => console.log(`  ${r.type}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkScoreStructure();
