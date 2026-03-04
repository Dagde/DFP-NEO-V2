import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('Connecting to Railway Postgres database...');
    
    // Query STAFF records (those with userId)
    const staffWithUserId = await prisma.personnel.count({
      where: {
        userId: {
          not: null
        }
      }
    });
    
    // Get all staff records with userId
    const allStaff = await prisma.personnel.findMany({
      where: {
        userId: {
          not: null
        }
      },
      select: {
        id: true,
        userId: true,
        name: true,
        rank: true,
        role: true,
        category: true,
        idNumber: true,
        isActive: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    // Get one example record
    const exampleStaff = allStaff[0] || null;
    
    // Also check total personnel count
    const totalPersonnel = await prisma.personnel.count();
    
    const result = {
      status: 'success',
      database: 'Railway Postgres',
      totalPersonnel: totalPersonnel,
      realStaffCount: staffWithUserId,
      mockdataCount: totalPersonnel - staffWithUserId,
      exampleStaff: exampleStaff,
      allStaff: allStaff
    };
    
    console.log('Query Results:', JSON.stringify(result, null, 2));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error querying database:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to query database',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}