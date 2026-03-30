#!/usr/bin/env node

/**
 * Script to analyze staff trainee assignments
 * This script connects to the database and reports:
 * - How many staff have 1, 2, 3, or 0 primary trainees
 * - How many staff have 1, 2, 3, or 0 secondary trainees
 * 
 * Usage: node analyze-staff-trainees.js
 */

const { PrismaClient } = require('@prisma/client');

async function analyzeStaffTrainees() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Connecting to database...');
    
    // Get all staff/instructors from the database
    const staff = await prisma.personnel.findMany({
      where: {
        role: { in: ['INSTRUCTOR', 'STAFF'] }
      },
      select: {
        id: true,
        name: true,
        rank: true,
        role: true,
        primaryTrainees: true,
        secondaryTrainees: true
      }
    });
    
    console.log(`\nTotal staff found: ${staff.length}\n`);
    
    // Analyze primary trainees
    const primaryCounts = {};
    staff.forEach(s => {
      const trainees = s.primaryTrainees || [];
      const count = Array.isArray(trainees) ? trainees.length : 0;
      primaryCounts[count] = (primaryCounts[count] || 0) + 1;
    });
    
    console.log('--- Primary Trainee Distribution ---');
    const maxPrimary = Math.max(...Object.keys(primaryCounts).map(Number), 0);
    for (let i = 0; i <= maxPrimary; i++) {
      console.log(`Staff with ${i} primary trainee(s): ${primaryCounts[i] || 0}`);
    }
    
    // Calculate percentages
    console.log('\n--- Primary Trainee Percentages ---');
    for (let i = 0; i <= maxPrimary; i++) {
      const count = primaryCounts[i] || 0;
      const percentage = ((count / staff.length) * 100).toFixed(1);
      console.log(`Staff with ${i} primary trainee(s): ${count} (${percentage}%)`);
    }
    
    // Analyze secondary trainees
    const secondaryCounts = {};
    staff.forEach(s => {
      const trainees = s.secondaryTrainees || [];
      const count = Array.isArray(trainees) ? trainees.length : 0;
      secondaryCounts[count] = (secondaryCounts[count] || 0) + 1;
    });
    
    console.log('\n--- Secondary Trainee Distribution ---');
    const maxSecondary = Math.max(...Object.keys(secondaryCounts).map(Number), 0);
    for (let i = 0; i <= maxSecondary; i++) {
      console.log(`Staff with ${i} secondary trainee(s): ${secondaryCounts[i] || 0}`);
    }
    
    // Calculate percentages
    console.log('\n--- Secondary Trainee Percentages ---');
    for (let i = 0; i <= maxSecondary; i++) {
      const count = secondaryCounts[i] || 0;
      const percentage = ((count / staff.length) * 100).toFixed(1);
      console.log(`Staff with ${i} secondary trainee(s): ${count} (${percentage}%)`);
    }
    
    // Show summary statistics
    console.log('\n--- Summary Statistics ---');
    const avgPrimary = (Object.entries(primaryCounts).reduce((sum, [count, num]) => sum + (parseInt(count) * num), 0) / staff.length).toFixed(2);
    const avgSecondary = (Object.entries(secondaryCounts).reduce((sum, [count, num]) => sum + (parseInt(count) * num), 0) / staff.length).toFixed(2);
    
    console.log(`Average primary trainees per staff: ${avgPrimary}`);
    console.log(`Average secondary trainees per staff: ${avgSecondary}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('DATABASE_URL')) {
      console.error('\nDATABASE_URL environment variable is not set.');
      console.error('This script must be run in an environment with database access.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

analyzeStaffTrainees();