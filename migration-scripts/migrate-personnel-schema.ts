import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePersonnelSchema() {
  console.log('🚀 Starting Personnel schema migration...');

  try {
    // Step 1: Get all existing personnel records
    console.log('📋 Fetching existing personnel records...');
    const personnel = await prisma.personnel.findMany();
    console.log(`✅ Found ${personnel.length} personnel records`);

    // Step 2: For each record, extract userId and convert to idNumber
    console.log('🔄 Converting userId to idNumber...');
    const updates = personnel.map(p => {
      // Extract numeric part from userId (assumes userId is numeric string)
      const idNumber = parseInt(p.userId, 10);
      
      // Parse existing qualifications JSON to extract structured data
      let qualifications = {};
      let category = null;
      let seatConfig = 'Normal';
      
      if (p.qualifications) {
        try {
          const qualData = typeof p.qualifications === 'string' 
            ? JSON.parse(p.qualifications) 
            : p.qualifications;
          qualifications = qualData;
          
          // Try to extract category from qualifications
          if (qualData.category) category = qualData.category;
          if (qualData.seatConfig) seatConfig = qualData.seatConfig;
        } catch (e) {
          console.warn(`⚠️ Could not parse qualifications for ${p.name}`);
        }
      }

      // Parse availability to unavailability
      let unavailability = p.availability;
      
      return {
        id: p.id,
        data: {
          idNumber: isNaN(idNumber) ? Math.floor(Math.random() * 9000000) + 1000000 : idNumber,
          category: category,
          seatConfig: seatConfig,
          unavailability: unavailability,
          // Set default values for boolean fields
          isTestingOfficer: false,
          isExecutive: false,
          isFlyingSupervisor: false,
          isIRE: false,
          isCommandingOfficer: false,
          isCFI: false,
          isDeputyFlightCommander: false,
          isContractor: false,
          isAdminStaff: false,
          isQFI: false,
          isOFI: false,
          // Empty permissions array
          permissions: [],
          // Empty prior experience
          priorExperience: null,
        }
      };
    });

    // Step 3: Create a backup of existing data
    console.log('💾 Creating backup...');
    const fs = require('fs');
    fs.writeFileSync(
      './personnel-backup.json',
      JSON.stringify(personnel, null, 2)
    );
    console.log('✅ Backup saved to personnel-backup.json');

    // Step 4: Update the database directly using raw SQL
    console.log('📝 Updating database schema...');
    
    // First, add the new columns with default values
    await prisma.$executeRaw`
      ALTER TABLE "Personnel" 
      ADD COLUMN IF NOT EXISTS "idNumber" INTEGER,
      ADD COLUMN IF NOT EXISTS "service" TEXT,
      ADD COLUMN IF NOT EXISTS "callsignNumber" INTEGER,
      ADD COLUMN IF NOT EXISTS "category" TEXT,
      ADD COLUMN IF NOT EXISTS "seatConfig" TEXT,
      ADD COLUMN IF NOT EXISTS "isTestingOfficer" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isExecutive" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isFlyingSupervisor" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isIRE" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isCommandingOfficer" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isCFI" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isDeputyFlightCommander" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isContractor" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isAdminStaff" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isQFI" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isOFI" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "location" TEXT,
      ADD COLUMN IF NOT EXISTS "unit" TEXT,
      ADD COLUMN IF NOT EXISTS "flight" TEXT,
      ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
      ADD COLUMN IF NOT EXISTS "email" TEXT,
      ADD COLUMN IF NOT EXISTS "permissions" TEXT[],
      ADD COLUMN IF NOT EXISTS "unavailability" JSONB
    `;
    console.log('✅ New columns added');

    // Step 5: Update each record with new data
    console.log('🔄 Updating personnel records...');
    for (const update of updates) {
      const d = update.data;
      await prisma.$executeRaw`
        UPDATE "Personnel"
        SET 
          "idNumber" = ${d.idNumber},
          "category" = ${d.category},
          "seatConfig" = ${d.seatConfig},
          "unavailability" = ${d.unavailability as any},
          "isTestingOfficer" = ${d.isTestingOfficer},
          "isExecutive" = ${d.isExecutive},
          "isFlyingSupervisor" = ${d.isFlyingSupervisor},
          "isIRE" = ${d.isIRE},
          "isCommandingOfficer" = ${d.isCommandingOfficer},
          "isCFI" = ${d.isCFI},
          "isDeputyFlightCommander" = ${d.isDeputyFlightCommander},
          "isContractor" = ${d.isContractor},
          "isAdminStaff" = ${d.isAdminStaff},
          "isQFI" = ${d.isQFI},
          "isOFI" = ${d.isOFI},
          "permissions" = ${d.permissions}
        WHERE id = ${update.id}
      `;
    }
    console.log(`✅ Updated ${updates.length} personnel records`);

    // Step 6: Add unique constraint on idNumber
    console.log('🔒 Adding unique constraint on idNumber...');
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "Personnel_idNumber_key" ON "Personnel"("idNumber")
    `;
    console.log('✅ Unique constraint added');

    // Step 7: Add unique constraint on userId
    console.log('🔒 Adding unique constraint on userId...');
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "Personnel_userId_key" ON "Personnel"("userId")
    `;
    console.log('✅ Unique constraint added');

    console.log('✅ Personnel schema migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Migrated ${personnel.length} personnel records`);
    console.log(`   - Added 20+ new fields`);
    console.log('   - Created backup at personnel-backup.json');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migratePersonnelSchema()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });