import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/user/personnel - Get current user's Personnel record
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [USER PERSONNEL] Fetching Personnel for current user:', session.user.userId);

    // Get the Personnel record linked to current user
    // Try to match by userId first (direct link), then by idNumber (PMKEYS)
    let personnel = await prisma.personnel.findFirst({
      where: {
        userId: session.user.userId
      }
    });

    // If not found by userId, try to match by idNumber (PMKEYS)
    if (!personnel) {
      console.log('🔍 [USER PERSONNEL] No Personnel found by userId, trying idNumber (PMKEYS)...');
      
      // Find ALL Personnel records matching idNumber (to handle duplicates)
      const allMatches = await prisma.personnel.findMany({
        where: {
          idNumber: parseInt(session.user.userId)
        }
      });
      
      if (allMatches.length > 1) {
        console.log(`⚠️  [USER PERSONNEL] Found ${allMatches.length} duplicate Personnel records for idNumber ${session.user.userId}`);
        allMatches.forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.name} - Rank: ${p.rank}, userId: ${p.userId}, Created: ${p.createdAt}`);
        });
      }
      
      // Prioritize: 1) Records with userId set, 2) Most recently created
      personnel = allMatches.find(p => p.userId !== null) || 
                  allMatches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      
      if (allMatches.length > 1) {
        console.log(`✅ [USER PERSONNEL] Selected: ${personnel.name} - Rank: ${personnel.rank}, Created: ${personnel.createdAt}`);
      }
    }

    if (!personnel) {
      console.log('⚠️  [USER PERSONNEL] No linked Personnel record for User:', session.user.userId);
      return NextResponse.json(
        { 
          error: 'Personnel record not linked',
          userId: session.user.userId,
          message: 'User exists but is not linked to any Personnel record'
        },
        { status: 404 }
      );
    }

    console.log('✅ [USER PERSONNEL] Personnel record found:', personnel.name, 'Rank:', personnel.rank);

    return NextResponse.json({
      success: true,
      rank: personnel.rank,
      name: personnel.name,
      idNumber: personnel.idNumber,
      personnel: personnel
    });
  } catch (error) {
    console.error('❌ [USER PERSONNEL] Error fetching personnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}