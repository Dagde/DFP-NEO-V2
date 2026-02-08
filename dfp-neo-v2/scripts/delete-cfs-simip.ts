import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteCFSSimIP() {
  try {
    console.log('🔍 Finding CFS Sim IP in database...');
    
    const cfsSimIP = await prisma.personnel.findFirst({
      where: {
        unit: 'CFS',
        role: 'SIM IP'
      }
    });
    
    if (!cfsSimIP) {
      console.log('✅ No CFS Sim IP found in database (already clean)');
      return;
    }
    
    console.log('❌ Found CFS Sim IP:', {
      id: cfsSimIP.id,
      idNumber: cfsSimIP.idNumber,
      name: cfsSimIP.name,
      rank: cfsSimIP.rank,
      unit: cfsSimIP.unit,
      role: cfsSimIP.role
    });
    
    console.log('🗑️  Deleting CFS Sim IP...');
    
    await prisma.personnel.delete({
      where: {
        id: cfsSimIP.id
      }
    });
    
    console.log('✅ CFS Sim IP deleted successfully!');
    console.log('✅ CFS now has NO Sim IPs (as required)');
    
  } catch (error) {
    console.error('❌ Error deleting CFS Sim IP:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteCFSSimIP();