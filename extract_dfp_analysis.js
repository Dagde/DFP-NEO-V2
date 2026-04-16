// JavaScript script to be run in browser console to extract DFP data and analyze priorities
// This script should be run in the browser's developer console while the app is running

(function() {
    console.log('🔍 Starting DFP Priority Analysis for April 16th...');
    
    // Find the React app's state
    const reactRoot = document.querySelector('#root');
    if (!reactRoot) {
        console.error('❌ React root not found');
        return;
    }
    
    // Try to access the React state
    const fiberKey = Object.keys(reactRoot).find(key => key.startsWith('__reactFiber'));
    if (!fiberKey) {
        console.error('❌ React fiber not found');
        return;
    }
    
    // Traverse React state to find publishedSchedules
    function traverseFiber(fiber) {
        if (!fiber) return null;
        
        // Check if this fiber has the state we need
        if (fiber.memoizedState && fiber.memoizedState.memoizedState) {
            const state = fiber.memoizedState.memoizedState;
            if (state.publishedSchedules) {
                return state;
            }
        }
        
        // Check child fibers
        if (fiber.child) {
            const childResult = traverseFiber(fiber.child);
            if (childResult) return childResult;
        }
        
        // Check sibling fibers
        if (fiber.sibling) {
            const siblingResult = traverseFiber(fiber.sibling);
            if (siblingResult) return siblingResult;
        }
        
        return null;
    }
    
    const reactState = traverseFiber(reactRoot[fiberKey]);
    
    if (!reactState) {
        console.error('❌ Could not find React state with publishedSchedules');
        return;
    }
    
    console.log('✅ React state found');
    console.log('Available dates:', Object.keys(reactState.publishedSchedules || {}));
    
    // Get April 16th data
    const targetDate = '2026-04-16';
    const april16Events = reactState.publishedSchedules?.[targetDate] || [];
    
    console.log(`\n📅 Events for ${targetDate}:`, april16Events.length);
    
    if (april16Events.length === 0) {
        console.log(`⚠️ No events found for ${targetDate}`);
        return;
    }
    
    // Filter flight events
    const flightEvents = april16Events.filter(e => e.type === 'flight');
    console.log(`\n✈️ Flight events: ${flightEvents.length}`);
    
    // Get trainees and scores data
    const trainees = reactState.trainees || [];
    const scores = reactState.scores || [];
    const buildDate = targetDate;
    
    // Calculate course medians
    function getCourseMedian(courseName) {
        const courseTrainees = trainees.filter(t => t.course === courseName && t.status === 'Active');
        if (courseTrainees.length === 0) return 0;
        
        const progressCounts = courseTrainees.map(t => {
            const tScores = scores.filter(s => s.trainee === t.fullName);
            return tScores.filter(s => !s.event.includes('-REM-')).length;
        }).sort((a, b) => a - b);
        
        const mid = Math.floor(progressCounts.length / 2);
        return progressCounts.length % 2 !== 0 ? progressCounts[mid] : 
               (progressCounts[mid - 1] + progressCounts[mid]) / 2;
    }
    
    // Calculate priority score
    function calculatePriorityScore(trainee, buildDate, courseMedian, traineeProgress, isRemedial) {
        const today = new Date(buildDate + 'T00:00:00Z').getTime();
        const lastEvent = trainee.lastEventDate ? new Date(trainee.lastEventDate + 'T00:00:00Z').getTime() : 0;
        const lastFlight = trainee.lastFlightDate ? new Date(trainee.lastFlightDate + 'T00:00:00Z').getTime() : 0;
        
        const daysSinceEvent = lastEvent === 0 ? 100 : Math.floor((today - lastEvent) / (1000 * 3600 * 24));
        const daysSinceFlight = lastFlight === 0 ? 100 : Math.floor((today - lastFlight) / (1000 * 3600 * 24));
        
        const lag = courseMedian - traineeProgress;
        
        let score = 0;
        score += daysSinceEvent * 2;
        score += daysSinceFlight * 1;
        score += lag * 5;
        
        if (isRemedial) score += 500;
        
        return score;
    }
    
    // Analyze each flight event
    const eventPriorities = flightEvents.map(event => {
        const studentName = event.student || event.pilot;
        const trainee = trainees.find(t => t.fullName === studentName);
        
        if (!trainee) {
            return {
                flightNumber: event.flightNumber,
                student: studentName,
                priority: 0,
                details: 'Trainee not found'
            };
        }
        
        const courseMedian = getCourseMedian(trainee.course);
        const traineeScores = scores.filter(s => s.trainee === studentName);
        const traineeProgress = traineeScores.filter(s => !s.event.includes('-REM-')).length;
        const isRemedial = event.flightNumber.includes('-REM-') || event.isRemedial;
        
        const priority = calculatePriorityScore(trainee, buildDate, courseMedian, traineeProgress, isRemedial);
        
        return {
            flightNumber: event.flightNumber,
            student: studentName,
            course: trainee.course,
            priority: priority,
            details: {
                daysSinceEvent: trainee.lastEventDate,
                daysSinceFlight: trainee.lastFlightDate,
                courseMedian: courseMedian,
                traineeProgress: traineeProgress,
                lag: courseMedian - traineeProgress,
                isRemedial: isRemedial
            }
        };
    });
    
    // Sort by priority (ascending - lowest first)
    eventPriorities.sort((a, b) => a.priority - b.priority);
    
    // Display results
    console.log('\n📊 FLIGHT EVENT PRIORITIES FOR APRIL 16TH');
    console.log('='.repeat(80));
    
    eventPriorities.forEach((evt, index) => {
        console.log(`\n${index + 1}. ${evt.flightNumber} - ${evt.student}`);
        console.log(`   Course: ${evt.course}`);
        console.log(`   Priority Score: ${evt.priority}`);
        if (evt.details && typeof evt.details === 'object') {
            console.log(`   Details:`, evt.details);
        } else {
            console.log(`   Details: ${evt.details}`);
        }
    });
    
    // Get the 10 lowest priority events
    const lowest10 = eventPriorities.slice(0, 10);
    
    console.log('\n🎯 10 LOWEST PRIORITY FLIGHT EVENTS');
    console.log('='.repeat(80));
    
    lowest10.forEach((evt, index) => {
        console.log(`\n${index + 1}. ${evt.flightNumber}`);
        console.log(`   Student: ${evt.student}`);
        console.log(`   Course: ${evt.course}`);
        console.log(`   Priority Score: ${evt.priority}`);
        if (evt.details && typeof evt.details === 'object' {
            console.log(`   Days Since Event: ${evt.details.daysSinceEvent || 'N/A'}`);
            console.log(`   Days Since Flight: ${evt.details.daysSinceFlight || 'N/A'}`);
            console.log(`   Course Median: ${evt.details.courseMedian}`);
            console.log(`   Trainee Progress: ${evt.details.traineeProgress}`);
            console.log(`   Lag (Behind Median): ${evt.details.lag}`);
            console.log(`   Remedial: ${evt.details.isRemedial ? 'Yes' : 'No'}`);
        }
    });
    
    // Export as JSON
    const result = {
        analysisDate: new Date().toISOString(),
        buildDate: targetDate,
        totalFlightEvents: flightEvents.length,
        lowest10Priorities: lowest10,
        allPriorities: eventPriorities
    };
    
    console.log('\n💾 Copy this JSON for export:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
})();