import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('🔍 Checking for duplicate idNumber values in Personnel table...\n');
    
    // Get all personnel
    const allPersonnel = await prisma.personnel.findMany({
      select: {
        id: true,
        idNumber: true,
        name: true,
        rank: true,
      },
      orderBy: {
        idNumber: 'asc',
      },
    });
    
    console.log(`Total records: ${allPersonnel.length}\n`);
    
    // Find duplicates by idNumber
    const idNumberMap = new Map();
    const duplicates = [];
    
    allPersonnel.forEach(person => {
      if (person.idNumber !== null) {
        if (idNumberMap.has(person.idNumber)) {
          duplicates.push({
            idNumber: person.idNumber,
            existing: idNumberMap.get(person.idNumber),
            duplicate: person,
          });
        } else {
          idNumberMap.set(person.idNumber, person);
        }
      }
    });
    
    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} duplicate idNumber values:\n`);
      
      duplicates.forEach((dup, index) => {
        console.log(`--- Duplicate ${index + 1} ---`);
        console.log(`idNumber: ${dup.idNumber}`);
        console.log(`Record 1:`);
        console.log(`  ID: ${dup.existing.id}`);
        console.log(`  Name: ${dup.existing.name}`);
        console.log(`  Rank: ${dup.existing.rank}`);
        console.log(`Record 2:`);
        console.log(`  ID: ${dup.duplicate.id}`);
        console.log(`  Name: ${dup.duplicate.name}`);
        console.log(`  Rank: ${dup.duplicate.rank}`);
        console.log();
      });
      
      console.log(`\n📊 Summary:`);
      console.log(`  Total records: ${allPersonnel.length}`);
      console.log(`  Unique idNumbers: ${idNumberMap.size}`);
      console.log(`  Duplicates found: ${duplicates.length}`);
    } else {
      console.log('✅ No duplicate idNumber values found!');
    }
    
    // Check for null idNumbers
    const nullIdNumbers = allPersonnel.filter(p => p.idNumber === null);
    if (nullIdNumbers.length > 0) {
      console.log(`\n⚠️  Found ${nullIdNumbers.length} records with null idNumber:`);
      nullIdNumbers.forEach(p => {
        console.log(`  ID: ${p.id}, Name: ${p.name}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();