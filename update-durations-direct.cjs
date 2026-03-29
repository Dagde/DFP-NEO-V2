const pg = require('pg');

const { Client } = pg;

async function updateDurationsDirect() {
  const client = new Client({
    connectionString: 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway'
  });

  try {
    console.log('Connecting to Railway PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Get all trainees in BPC+IPC and FIC courses
    // Note: Database uses 'FIC 210', 'FIC211' for FIC courses
    // BPC+IPC courses appear to be ADF301-ADF305
    const traineesQuery = `
      SELECT "idNumber", name, course 
      FROM "Trainee" 
      WHERE course IN ('FIC 210', 'FIC211', 'ADF301', 'ADF302', 'ADF303', 'ADF304', 'ADF305')
    `;
    
    const traineesResult = await client.query(traineesQuery);
    console.log(`Found ${traineesResult.rows.length} trainees in BPC+IPC and FIC courses`);
    
    // Group by course
    const bpcTrainees = traineesResult.rows.filter(t => t.course === 'BPC+IPC');
    const ficTrainees = traineesResult.rows.filter(t => t.course === 'FIC');
    
    console.log(`BPC+IPC trainees: ${bpcTrainees.length}`);
    console.log(`FIC trainees: ${ficTrainees.length}\n`);
    
    let totalFlightUpdates = 0;
    let totalFtdUpdates = 0;
    const details = [];
    
    // Update events for each trainee
    for (const trainee of traineesResult.rows) {
      const traineeId = trainee.idNumber;
      
      // Update flight events (type: 'flight') to 1.2hrs
      const flightUpdateQuery = `
        UPDATE "ScheduleEvent" 
        SET duration = 1.2 
        WHERE "traineeId" = $1 AND type = 'flight'
      `;
      
      const flightResult = await client.query(flightUpdateQuery, [traineeId]);
      const flightCount = flightResult.rowCount;
      
      // Update FTD events (type: 'ftd') to 2.0hrs
      const ftdUpdateQuery = `
        UPDATE "ScheduleEvent" 
        SET duration = 2.0 
        WHERE "traineeId" = $1 AND type = 'ftd'
      `;
      
      const ftdResult = await client.query(ftdUpdateQuery, [traineeId]);
      const ftdCount = ftdResult.rowCount;
      
      totalFlightUpdates += flightCount;
      totalFtdUpdates += ftdCount;
      
      if (flightCount > 0 || ftdCount > 0) {
        details.push({
          traineeName: trainee.name,
          course: trainee.course,
          flightUpdates: flightCount,
          ftdUpdates: ftdCount
        });
        console.log(`[Trainee ${trainee.name} (${trainee.course})]: Updated ${flightCount} flight events to 1.2hrs and ${ftdCount} FTD events to 2.0hrs`);
      }
    }
    
    console.log('\n✅ Duration updates completed successfully!');
    console.log(`Total: ${totalFlightUpdates} flight events updated to 1.2hrs`);
    console.log(`Total: ${totalFtdUpdates} FTD events updated to 2.0hrs`);
    
    console.log('\nDetails by trainee:');
    details.forEach(d => {
      console.log(`  ${d.traineeName} (${d.course}): ${d.flightUpdates} flights, ${d.ftdUpdates} FTDs`);
    });
    
  } catch (error) {
    console.error('Error updating durations:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n📊 Database connection closed');
  }
}

updateDurationsDirect();