import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// POST /api/debug/cleanup-duplicates - Clean up duplicate Personnel records
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🧹 [CLEANUP] Starting duplicate Personnel cleanup...');

    // Get all Personnel records
    const allPersonnel = await prisma.personnel.findMany({
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📊 [CLEANUP] Total Personnel records: ${allPersonnel.length}`);

    // Group by idNumber to find duplicates
    const duplicatesByNumber: { [key: number]: any[] } = {};
    
    for (const person of allPersonnel) {
      if (person.idNumber) {
        if (!duplicatesByNumber[person.idNumber]) {
          duplicatesByNumber[person.idNumber] = [];
        }
        duplicatesByNumber[person.idNumber].push(person);
      }
    }

    // Find duplicates (more than 1 record with same idNumber)
    const duplicates = Object.entries(duplicatesByNumber)
      .filter(([_, records]) => records.length > 1)
      .map(([idNumber, records]) => ({
        idNumber: parseInt(idNumber),
        records,
        count: records.length
      }));

    console.log(`⚠️ [CLEANUP] Found ${duplicates.length} sets of duplicates`);

    let totalDeleted = 0;
    const cleanupResults: any[] = [];

    // For each set of duplicates, keep the best one and delete the rest
    for (const duplicate of duplicates) {
      const { idNumber, records } = duplicate;

      // Prioritize: 1) Records with userId set, 2) Most recently created
      const sortedRecords = records.sort((a, b) => {
        // Records with userId come first
        if (a.userId && !b.userId) return -1;
        if (!a.userId && b.userId) return 1;
        // Then by creation date (most recent first)
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      // Keep the first (best) record
      const toKeep = sortedRecords[0];
      const toDelete = sortedRecords.slice(1);

      console.log(`\n🔄 [CLEANUP] Processing duplicates for ${toKeep.name} (ID: ${idNumber})`);
      console.log(`  ✅ Keeping: ${toKeep.id} - Rank: ${toKeep.rank}, userId: ${toKeep.userId}`);
      console.log(`  🗑️ Deleting ${toDelete.length} duplicate(s)`);

      // Delete the duplicates
      for (const record of toDelete) {
        try {
          await prisma.personnel.delete({
            where: { id: record.id }
          });
          console.log(`    - Deleted: ${record.id} - Rank: ${record.rank}, userId: ${record.userId}`);
          totalDeleted++;
        } catch (error) {
          console.error(`    ❌ Failed to delete ${record.id}:`, error);
        }
      }

      cleanupResults.push({
        idNumber,
        name: toKeep.name,
        kept: {
          id: toKeep.id,
          rank: toKeep.rank,
          userId: toKeep.userId
        },
        deleted: toDelete.map(r => ({
          id: r.id,
          rank: r.rank,
          userId: r.userId
        }))
      });
    }

    console.log(`\n✅ [CLEANUP] Complete! Deleted ${totalDeleted} duplicate records`);

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${totalDeleted} duplicate Personnel records`,
      totalDuplicatesFound: duplicates.length,
      totalDeleted,
      cleanupResults
    });
  } catch (error) {
    console.error('❌ [CLEANUP] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup duplicates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}