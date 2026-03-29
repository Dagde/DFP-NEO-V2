const pg = require('pg');
const { Client } = pg;

async function checkAllTables() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    await client.connect();
    
    const tables = ['Schedule', 'FlightSchedule', 'Personnel', 'Trainee', 'Score', 'IndividualLMP', 'SctRequest', 'CancellationHistory'];
    
    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
        console.log(`${table}: ${countResult.rows[0].count} records`);
      } catch (e) {
        console.log(`${table}: ERROR - ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Connection error:', error.message);
  } finally {
    await client.end();
  }
}

checkAllTables();
