import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function investigateBurns() {
    try {
        console.log('🔍 Investigating Burns records in database...\n');

        // Find all Burns records
        const burnsRecords = await prisma.personnel.findMany({
            where: {
                name: {
                    contains: 'Burns'
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        console.log(`📊 Total Burns records found: ${burnsRecords.length}\n`);

        if (burnsRecords.length === 0) {
            console.log('❌ No Burns records found in database');
            return;
        }

        burnsRecords.forEach((record, index) => {
            console.log(`\n--- Burns Record ${index + 1} ---`);
            console.log(`ID: ${record.id}`);
            console.log(`PMKEYS (idNumber): ${record.idNumber}`);
            console.log(`Name: ${record.name}`);
            console.log(`Rank: ${record.rank}`);
            console.log(`Role: ${record.role}`);
            console.log(`Unit: ${record.unit}`);
            console.log(`isQFI: ${record.isQFI}`);
            console.log(`isOFI: ${record.isOFI}`);
            console.log(`Created: ${record.createdAt}`);
        });

        // Check for duplicates by idNumber
        const idNumbers = {};
        burnsRecords.forEach(record => {
            if (record.idNumber) {
                if (!idNumbers[record.idNumber]) {
                    idNumbers[record.idNumber] = [];
                }
                idNumbers[record.idNumber].push(record);
            }
        });

        console.log('\n\n🔍 Checking for duplicate idNumbers...');
        let hasDuplicates = false;
        Object.keys(idNumbers).forEach(idNumber => {
            if (idNumbers[idNumber].length > 1) {
                hasDuplicates = true;
                console.log(`\n⚠️  Found ${idNumbers[idNumber].length} records with idNumber ${idNumber}`);
            }
        });

        if (!hasDuplicates) {
            console.log('✅ No duplicate idNumbers found');
        }

        // Total personnel count
        const totalPersonnel = await prisma.personnel.count();
        console.log(`\n\n📊 Total personnel in database: ${totalPersonnel}`);

    } catch (error) {
        console.error('❌ Error investigating Burns records:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateBurns();