const { PrismaClient } = require('./dfp-neo-platform/node_modules/@prisma/client');
const bcrypt = require('./dfp-neo-platform/node_modules/bcryptjs');

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    // Find the admin user
    const admin = await prisma.user.findUnique({
      where: { userId: 'admin' }
    });

    if (!admin) {
      console.error('Admin user not found!');
      return;
    }

    // Reset password to admin123
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedPassword }
    });

    console.log('✅ Admin password has been reset successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
  } catch (error) {
    console.error('Error resetting admin password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();