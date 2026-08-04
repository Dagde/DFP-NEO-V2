import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { debugRoutesDisabledResponse } from '../guard';

const prisma = new PrismaClient();

// GET /api/debug/database-connection - Check database connection and Alexander Burns' data
export async function GET() {
  const disabled = debugRoutesDisabledResponse();
  if (disabled) return disabled;

  try {
    // Get database URL (without password)
    const dbUrl = process.env.DATABASE_URL || 'Not set';
    const safeDbUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    
    console.log('🔍 [DEBUG] Database URL:', safeDbUrl);
    
    // Test connection
    await prisma.$connect();
    console.log('✅ [DEBUG] Connected to database');
    
    // Get all Personnel with idNumber 8201112
    const allBurnsPersonnel = await prisma.personnel.findMany({
      where: {
        idNumber: 8201112
      },
      select: {
        id: true,
        name: true,
        rank: true,
        userId: true,
        idNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    console.log(`📊 [DEBUG] Found ${allBurnsPersonnel.length} Personnel records with idNumber 8201112`);
    
    // Get all Personnel with name containing "Burns"
    const allBurnsByName = await prisma.personnel.findMany({
      where: {
        name: {
          contains: 'Burns'
        }
      },
      select: {
        id: true,
        name: true,
        rank: true,
        userId: true,
        idNumber: true,
        isActive: true
      }
    });
    
    console.log(`📊 [DEBUG] Found ${allBurnsByName.length} Personnel records with name containing 'Burns'`);
    
    // Get User with userId 8201112
    const user = await prisma.user.findUnique({
      where: {
        userId: '8201112'
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    return NextResponse.json({
      database: {
        connected: true,
        url: safeDbUrl,
        environment: process.env.NODE_ENV || 'unknown'
      },
      user: user,
      personnelByIdNumber: allBurnsPersonnel,
      personnelByName: allBurnsByName,
      summary: {
        totalPersonnelWithBurnsName: allBurnsByName.length,
        totalPersonnelWithId8201112: allBurnsPersonnel.length
      }
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check database connection',
        details: error instanceof Error ? error.message : 'Unknown error',
        databaseUrl: process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
