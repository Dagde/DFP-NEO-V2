/**
 * API Endpoint: GET /api/staff-trainee-analysis
 * 
 * Returns analysis of staff trainee assignments:
 * - Distribution of primary trainees per staff
 * - Distribution of secondary trainees per staff
 * - Percentages and averages
 * 
 * This can be added to the server.js file
 */

app.get('/api/staff-trainee-analysis', async (req, res) => {
  try {
    const prisma = await getPrisma();
    
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
    
    // Analyze primary trainees
    const primaryCounts = {};
    staff.forEach(s => {
      const trainees = s.primaryTrainees || [];
      const count = Array.isArray(trainees) ? trainees.length : 0;
      primaryCounts[count] = (primaryCounts[count] || 0) + 1;
    });
    
    // Analyze secondary trainees
    const secondaryCounts = {};
    staff.forEach(s => {
      const trainees = s.secondaryTrainees || [];
      const count = Array.isArray(trainees) ? trainees.length : 0;
      secondaryCounts[count] = (secondaryCounts[count] || 0) + 1;
    });
    
    // Calculate summary statistics
    const totalStaff = staff.length;
    const totalPrimaryTrainees = Object.entries(primaryCounts).reduce((sum, [count, num]) => sum + (parseInt(count) * num), 0);
    const totalSecondaryTrainees = Object.entries(secondaryCounts).reduce((sum, [count, num]) => sum + (parseInt(count) * num), 0);
    
    const avgPrimary = (totalPrimaryTrainees / totalStaff).toFixed(2);
    const avgSecondary = (totalSecondaryTrainees / totalStaff).toFixed(2);
    
    // Build distribution arrays
    const maxPrimary = Math.max(...Object.keys(primaryCounts).map(Number), 0);
    const maxSecondary = Math.max(...Object.keys(secondaryCounts).map(Number), 0);
    
    const primaryDistribution = [];
    for (let i = 0; i <= maxPrimary; i++) {
      const count = primaryCounts[i] || 0;
      primaryDistribution.push({
        traineeCount: i,
        staffCount: count,
        percentage: ((count / totalStaff) * 100).toFixed(1)
      });
    }
    
    const secondaryDistribution = [];
    for (let i = 0; i <= maxSecondary; i++) {
      const count = secondaryCounts[i] || 0;
      secondaryDistribution.push({
        traineeCount: i,
        staffCount: count,
        percentage: ((count / totalStaff) * 100).toFixed(1)
      });
    }
    
    res.json({
      success: true,
      data: {
        totalStaff,
        summary: {
          averagePrimaryTrainees: avgPrimary,
          averageSecondaryTrainees: avgSecondary,
          totalPrimaryAssignments: totalPrimaryTrainees,
          totalSecondaryAssignments: totalSecondaryTrainees
        },
        primaryDistribution,
        secondaryDistribution
      }
    });
    
  } catch (error) {
    console.error('Error in staff-trainee-analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});