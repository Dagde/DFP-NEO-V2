import React, { useState, useMemo } from 'react';
import { Trainee, Instructor, ScheduleEvent, Course, Score, Pt051Assessment } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface TrainingRecordsExportViewProps {
    traineesData: Trainee[];
    instructorsData: Instructor[];
    archivedTraineesData: Trainee[];
    archivedInstructorsData: Instructor[];
    events: ScheduleEvent[];
    courses: Course[];
    archivedCourses: { [key: string]: string };
    scores: Map<string, Score[]>;
    publishedSchedules: Record<string, ScheduleEvent[]>;
}

type RecordType = 'all' | 'trainees' | 'staff' | 'events';
type TimePeriod = 'all-time' | 'single-date' | 'date-range';
type OutputFormat = 'pdf' | 'excel' | 'csv';
type EventType = 'Flight' | 'FTD' | 'CPT' | 'Ground';
type StatusFilter = 'all' | 'dco' | 'dnco' | 'pass' | 'fail';
type RemedialFilter = 'all' | 'yes' | 'no';

interface ExportTemplate {
    name: string;
    recordType: RecordType;
    timePeriod: TimePeriod;
    singleDate: string;
    startDate: string;
    endDate: string;
    outputFormat: OutputFormat;
    selectedTrainees: string[];
    selectedStaff: string[];
    selectedCourses: string[];
    selectedEventTypes: EventType[];
    statusFilter: StatusFilter;
    remedialFilter: RemedialFilter;
}

const TrainingRecordsExportView: React.FC<TrainingRecordsExportViewProps> = ({
    traineesData,
    instructorsData,
    archivedTraineesData,
    archivedInstructorsData,
    events,
    courses,
    archivedCourses,
    scores,
    publishedSchedules
}) => {
    // Core export settings
    const [recordType, setRecordType] = useState<RecordType>('all');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('all-time');
    const [singleDate, setSingleDate] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('pdf');

    // Optional filters
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
    const [selectedEventTypes, setSelectedEventTypes] = useState<EventType[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [remedialFilter, setRemedialFilter] = useState<RemedialFilter>('all');
    
    // Search filters
    const [courseSearch, setCourseSearch] = useState('');
    const [traineeSearch, setTraineeSearch] = useState('');
    const [staffSearch, setStaffSearch] = useState('');

    // Template management
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [showExportSuccess, setShowExportSuccess] = useState(false);
    const [showExportError, setShowExportError] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStatus, setExportStatus] = useState('');
    const [savedTemplates, setSavedTemplates] = useState<ExportTemplate[]>([]);

    // Format date as dd MMM yy
    const formatDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = date.toLocaleString('en-GB', { month: 'short' });
        const year = String(date.getFullYear()).slice(-2);
        return `${day} ${month} ${year}`;
    };

    // Get all events from published schedules
    const allEvents = useMemo(() => {
        const events = Object.values(publishedSchedules).flat();
        console.log('📊 Export View - All events from published schedules:', events.length);
        console.log('📊 Export View - Published schedule dates:', Object.keys(publishedSchedules));
        return events;
    }, [publishedSchedules]);
    
    // Combine active and archived data
    const allTrainees = useMemo(() => {
        const combined = [...traineesData, ...archivedTraineesData];
        console.log('📊 Export View - All trainees:', combined.length);
        console.log('📊 Export View - ADF303 trainees:', combined.filter(t => t.course === 'ADF303').length);
        return combined;
    }, [traineesData, archivedTraineesData]);
    const allInstructors = useMemo(() => [...instructorsData, ...archivedInstructorsData], [instructorsData, archivedInstructorsData]);
    const allCourseNames = useMemo(() => {
        const activeCourses = courses.map(c => c.name);
        const archivedCourseNames = Object.keys(archivedCourses);
        return [...new Set([...activeCourses, ...archivedCourseNames])];
    }, [courses, archivedCourses]);
    
    // Filtered lists for dropdowns
    const filteredCourses = useMemo(() => {
        return allCourseNames.filter(name => 
            name.toLowerCase().includes(courseSearch.toLowerCase())
        );
    }, [allCourseNames, courseSearch]);
    
    const filteredTrainees = useMemo(() => {
        return allTrainees.filter(t => 
            `${t.rank} ${t.name} ${t.course}`.toLowerCase().includes(traineeSearch.toLowerCase())
        );
    }, [allTrainees, traineeSearch]);
    
    const filteredStaff = useMemo(() => {
        return allInstructors.filter(i => 
            `${i.rank} ${i.name}`.toLowerCase().includes(staffSearch.toLowerCase())
        );
    }, [allInstructors, staffSearch]);

    // Filter events based on current settings
    const filteredEvents = useMemo(() => {
        let filtered = [...allEvents];

        // Time period filter
        if (timePeriod === 'single-date' && singleDate) {
            filtered = filtered.filter(e => e.date === singleDate);
        } else if (timePeriod === 'date-range' && startDate && endDate) {
            filtered = filtered.filter(e => e.date >= startDate && e.date <= endDate);
        }

        // Event type filter
        if (selectedEventTypes.length > 0) {
            filtered = filtered.filter(e => selectedEventTypes.includes(e.type as EventType));
        }

        // Status filter - based on PT051 outcomes
        if (statusFilter === 'dco') {
            filtered = filtered.filter(e => {
                const trainee = e.student || e.pilot;
                if (!trainee) return false;
                const traineeScores = scores.get(trainee);
                if (!traineeScores) return false;
                const eventScore = traineeScores.find(s => s.syllabusId === e.flightNumber && s.date === e.date);
                return eventScore?.outcome === 'DCO';
            });
        } else if (statusFilter === 'dnco') {
            filtered = filtered.filter(e => {
                const trainee = e.student || e.pilot;
                if (!trainee) return false;
                const traineeScores = scores.get(trainee);
                if (!traineeScores) return false;
                const eventScore = traineeScores.find(s => s.syllabusId === e.flightNumber && s.date === e.date);
                return eventScore?.outcome === 'DNCO';
            });
        } else if (statusFilter === 'pass') {
            filtered = filtered.filter(e => {
                const trainee = e.student || e.pilot;
                if (!trainee) return false;
                const traineeScores = scores.get(trainee);
                if (!traineeScores) return false;
                const eventScore = traineeScores.find(s => s.syllabusId === e.flightNumber && s.date === e.date);
                return eventScore?.outcome === 'Pass';
            });
        } else if (statusFilter === 'fail') {
            filtered = filtered.filter(e => {
                const trainee = e.student || e.pilot;
                if (!trainee) return false;
                const traineeScores = scores.get(trainee);
                if (!traineeScores) return false;
                const eventScore = traineeScores.find(s => s.syllabusId === e.flightNumber && s.date === e.date);
                return eventScore?.outcome === 'Fail';
            });
        }

        // Remedial filter
        if (remedialFilter === 'yes') {
            filtered = filtered.filter(e => e.isRemedial);
        } else if (remedialFilter === 'no') {
            filtered = filtered.filter(e => !e.isRemedial);
        }

        // People filter - FIXED: Handle course suffix in event names
        if (selectedTrainees.length > 0) {
            console.log('📊 Trainee filter - Selected trainees:', selectedTrainees);
            console.log('📊 Trainee filter - Events before filter:', filtered.length);
            
            filtered = filtered.filter(e => {
                const studentName = e.student || e.pilot;
                if (!studentName) return false;
                
                // Check if the student name (with or without course suffix) matches any selected trainee
                const matches = selectedTrainees.some(selectedTrainee => {
                    // Check exact match
                    if (studentName === selectedTrainee) return true;
                    // Check if student name starts with selected trainee name followed by course suffix
                    if (studentName.startsWith(selectedTrainee + ' –') || studentName.startsWith(selectedTrainee + ' -')) return true;
                    return false;
                });
                
                return matches;
            });
            
            console.log('📊 Trainee filter - Events after filter:', filtered.length);
        }
        if (selectedStaff.length > 0) {
            filtered = filtered.filter(e => 
                e.instructor && selectedStaff.includes(e.instructor)
            );
        }

        // Course filter - FIXED: Handle course suffix in event names
        if (selectedCourses.length > 0) {
            const courseTrainees = allTrainees.filter(t => selectedCourses.includes(t.course));
            const traineeNames = courseTrainees.map(t => t.name);
            console.log('📊 Course filter - Selected courses:', selectedCourses);
            console.log('📊 Course filter - Trainees in selected courses:', courseTrainees.length);
            console.log('📊 Course filter - Trainee names (first 5):', traineeNames.slice(0, 5));
            console.log('📊 Course filter - Events before filter:', filtered.length);
            console.log('📊 Course filter - Sample event student names (first 5):', filtered.slice(0, 5).map(e => e.student || e.pilot));
            
            // Match trainee names with or without course suffix (e.g., "Edwards, Charlotte" or "Edwards, Charlotte – ADF301")
            filtered = filtered.filter(e => {
                const studentName = e.student || e.pilot;
                if (!studentName) return false;
                
                // Check if the student name (with or without course suffix) matches any trainee
                const matches = traineeNames.some(traineeName => {
                    // Check exact match
                    if (studentName === traineeName) return true;
                    // Check if student name starts with trainee name followed by course suffix
                    if (studentName.startsWith(traineeName + ' –') || studentName.startsWith(traineeName + ' -')) return true;
                    return false;
                });
                
                if (!matches) {
                    console.log('📊 No match for student:', studentName);
                }
                
                return matches;
            });
            console.log('📊 Course filter - Events after filter:', filtered.length);
        }

        return filtered;
    }, [allEvents, timePeriod, singleDate, startDate, endDate, selectedEventTypes, 
        statusFilter, remedialFilter, selectedTrainees, selectedStaff, selectedCourses, traineesData]);

    // Calculate filtered data based on record type
    const filteredData = useMemo(() => {
        console.log('📊 filteredData calculation - recordType:', recordType);
        console.log('📊 filteredData calculation - filteredEvents:', filteredEvents.length);
        console.log('📊 filteredData calculation - allTrainees:', allTrainees.length);
        console.log('📊 filteredData calculation - allInstructors:', allInstructors.length);
        
        // For "events only", return only events with no people records
        if (recordType === 'events') {
            return { events: filteredEvents, trainees: [], staff: [] };
        }

        // For trainee/staff/all records, include ALL people (not just those with events)
        // This matches user expectation: "Trainee records" = all trainees, not just those with events
        
        if (recordType === 'trainees') {
            console.log('📊 Returning all trainees:', allTrainees.length);
            return { events: filteredEvents, trainees: allTrainees, staff: [] };
        } else if (recordType === 'staff') {
            console.log('📊 Returning all staff:', allInstructors.length);
            return { events: filteredEvents, trainees: [], staff: allInstructors };
        } else {
            // recordType === 'all'
            console.log('📊 Returning all trainees and staff');
            return { events: filteredEvents, trainees: allTrainees, staff: allInstructors };
        }
    }, [recordType, filteredEvents, allTrainees, allInstructors]);

    // Calculate record count
    const recordCount = useMemo(() => {
        let count = 0;
        if (recordType === 'all' || recordType === 'trainees') count += filteredData.trainees.length;
        if (recordType === 'all' || recordType === 'staff') count += filteredData.staff.length;
        if (recordType === 'all' || recordType === 'events') count += filteredData.events.length;
        return count;
    }, [recordType, filteredData]);

    // Estimate file size (rough approximation)
    const estimatedSize = useMemo(() => {
        const bytesPerRecord = outputFormat === 'pdf' ? 5000 : outputFormat === 'excel' ? 2000 : 500;
        const totalBytes = recordCount * bytesPerRecord;
        if (totalBytes < 1024) return `${totalBytes} B`;
        if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
        return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }, [recordCount, outputFormat]);

    // Check if export is large
    const isLargeExport = recordCount > 1000;

    // Get time period description
    const getTimePeriodDescription = () => {
        if (timePeriod === 'all-time') return 'All time';
        if (timePeriod === 'single-date' && singleDate) return formatDate(singleDate);
        if (timePeriod === 'date-range' && startDate && endDate) {
            return `${formatDate(startDate)} to ${formatDate(endDate)}`;
        }
        return 'Not specified';
    };

    // Get record type description
    const getRecordTypeDescription = () => {
        if (recordType === 'all') return 'All records (Trainees, Staff, Events)';
        if (recordType === 'trainees') return 'Trainee records';
        if (recordType === 'staff') return 'Staff records';
        return 'Event records';
    };

    // Handle export
    const handleExport = async () => {
        console.log('🚀 Starting export...', {
            recordType,
            timePeriod,
            outputFormat,
            recordCount,
            data: filteredData
        });
        
        // Generate filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `training_records_${timestamp}.${outputFormat}`;
        
        try {
            console.log('📄 Export format:', outputFormat);
            
            // Show progress indicator
            setIsExporting(true);
            setExportProgress(0);
            setExportStatus('Preparing export...');
            
            if (outputFormat === 'csv') {
                console.log('📊 Exporting CSV...');
                setExportStatus('Generating CSV file...');
                exportToCSV(filename);
                console.log('✅ CSV export completed');
            } else if (outputFormat === 'excel') {
                console.log('📊 Exporting Excel...');
                setExportStatus('Generating Excel file...');
                exportToExcel(filename);
                console.log('✅ Excel export completed');
            } else if (outputFormat === 'pdf') {
                console.log('📄 Exporting PDF...');
                console.log('📄 Events to export:', filteredData.events.length);
                setExportStatus(`Generating PDF (${filteredData.events.length} records)...`);
                await exportToPDF(filename);
                console.log('✅ PDF export completed');
            }
            
            // Hide progress and show success message
            setIsExporting(false);
            console.log('✅ Showing success message');
            setShowExportSuccess(true);
            setTimeout(() => setShowExportSuccess(false), 5000);
        } catch (error) {
            console.error('❌ Export error:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            setIsExporting(false);
            setShowExportError(true);
            setTimeout(() => setShowExportError(false), 5000);
        }
    };
    
    const exportToCSV = (filename: string) => {
        let csvContent = '';
        
        // Add Events
        if (recordType === 'all' || recordType === 'events') {
            csvContent += 'EVENTS\n';
            csvContent += 'Date,Type,Instructor,Student,Flight Number,Duration,Start Time,Resource\n';
            filteredData.events.forEach(e => {
                csvContent += `${e.date},${e.type},${e.instructor || ''},${e.student || e.pilot || ''},${e.flightNumber || ''},${e.duration || ''},${e.startTime || ''},${e.resourceId || ''}\n`;
            });
            csvContent += '\n';
        }
        
        // Add Trainees
        if (recordType === 'all' || recordType === 'trainees') {
            csvContent += 'TRAINEES\n';
            csvContent += 'Name,Rank,Course,Service,Unit,Flight\n';
            filteredData.trainees.forEach(t => {
                csvContent += `${t.name},${t.rank},${t.course},${t.service},${t.unit},${t.flight}\n`;
            });
            csvContent += '\n';
        }
        
        // Add Staff
        if (recordType === 'all' || recordType === 'staff') {
            csvContent += 'STAFF\n';
            csvContent += 'Name,Rank,Role,Category,Service\n';
            filteredData.staff.forEach(s => {
                csvContent += `${s.name},${s.rank},${s.role},${s.category || ''},${s.service}\n`;
            });
        }
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };
    
    const exportToExcel = (filename: string) => {
        // For now, export as CSV with .xlsx extension
        // TODO: Implement proper Excel export with a library like xlsx
        exportToCSV(filename.replace('.xlsx', '.csv'));
    };
    
    const exportToPDF = async (filename: string) => {
        console.log('📄 exportToPDF called with filename:', filename);
        
        // Generate PT051 forms for each event
        const eventsToExport = filteredData.events;
        console.log('📄 Events to export:', eventsToExport.length);
        
        if (eventsToExport.length === 0) {
            console.log('❌ No events to export');
            throw new Error('No events to export');
        }
        
        console.log('📄 Creating PDF document...');
        const pdf = new jsPDF('p', 'mm', 'a4');
        let isFirstPage = true;
        
        try {
            console.log('📄 Starting to process events...');
            for (let i = 0; i < eventsToExport.length; i++) {
                const event = eventsToExport[i];
                const progress = Math.round(((i + 1) / eventsToExport.length) * 100);
                setExportProgress(progress);
                setExportStatus(`Processing record ${i + 1} of ${eventsToExport.length}...`);
                
                console.log(`📄 Processing event ${i + 1}/${eventsToExport.length}:`, event.flightNumber);
                
                if (!isFirstPage) {
                    pdf.addPage();
                }
                
                // Render PT051 form using native PDF text
                renderPT051ToPDF(pdf, event);
                
                console.log('✅ PT051 added to PDF');
                isFirstPage = false;
            }
            
            // Download the PDF
            setExportStatus('Finalizing PDF...');
            console.log('📄 Saving PDF:', filename);
            pdf.save(filename);
            console.log('✅ PDF saved successfully!');
            
        } catch (error) {
            console.error('❌ Error during PDF generation:', error);
            throw error;
        }
    };
    
    // Helper function to parse PT051 comments into sections
    const parseComments = (raw: string | undefined) => {
        const defaults = { QFI: '', Weather: '', Profile: '', Overall: '', NEST: '' };
        if (!raw) return defaults;
        
        const result = { ...defaults };
        const sections = ['QFI', 'Weather', 'Profile', 'Overall', 'NEST'];
        
        sections.forEach((section, index) => {
            const nextSection = sections[index + 1];
            const startMarker = `${section}:`;
            const startIndex = raw.indexOf(startMarker);
            
            if (startIndex !== -1) {
                let contentStart = startIndex + startMarker.length;
                let endIndex = -1;
                
                if (nextSection) {
                    const nextMarker = `${nextSection}:`;
                    endIndex = raw.indexOf(nextMarker, contentStart);
                }
                
                let content = '';
                if (endIndex !== -1) {
                    content = raw.substring(contentStart, endIndex);
                } else {
                    content = raw.substring(contentStart);
                }
                
                result[section as keyof typeof defaults] = content.trim();
            }
        });
        
        return result;
    };
    
    const renderPT051ToPDF = (pdf: jsPDF, event: ScheduleEvent) => {
        const trainee = allTrainees.find(t => t.fullName === event.student || t.fullName === event.pilot);
        const instructor = allInstructors.find(i => i.name === event.instructor);
        
        // Get scores for this event
        const traineeScores = scores.get(event.student || event.pilot || '');
        const eventScore = traineeScores?.find(s => s.syllabusId === event.flightNumber && s.date === event.date);
        
        // Parse comments into sections
        const commentSections = parseComments(eventScore?.comments);
        
        // PT051 structure with all elements
        const pt051Structure = [
            { category: 'Core Dimensions', elements: ['Airmanship', 'Preparation', 'Technique'] },
            { category: 'Procedural Framework', elements: ['Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks'] },
            { category: 'Takeoff', elements: ['Stationary'] },
            { category: 'Departure', elements: ['Visual'] },
            { category: 'Core Handling Skills', elements: ['Effects of Control', 'Trimming', 'Straight and Level'] },
            { category: 'Turns', elements: ['Level medium Turn', 'Level Steep turn'] },
            { category: 'Recovery', elements: ['Visual - Initial &amp; Pitch'] },
            { category: 'Landing', elements: ['Landing', 'Crosswind'] },
            { category: 'Domestics', elements: ['Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'] }
        ];
        
        let y = 15;
        const margin = 15;
        const pageWidth = 210;
        const contentWidth = pageWidth - (2 * margin);
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('RAAF PT-051 Training Assessment', pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        pdf.setLineWidth(0.5);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 8;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        const col1X = margin;
        const col2X = pageWidth / 2 + 5;
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Trainee:', col1X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${trainee?.rank || ''} ${trainee?.name || event.student || event.pilot || 'N/A'}`, col1X + 20, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Course:', col2X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(trainee?.course || 'N/A', col2X + 20, y);
        y += 5;
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Instructor:', col1X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${instructor?.rank || ''} ${instructor?.name || event.instructor || 'N/A'}`, col1X + 20, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Date:', col2X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(event.date || 'N/A', col2X + 20, y);
        y += 5;
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Flight:', col1X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(event.flightNumber || 'N/A', col1X + 20, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Duration:', col2X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(event.duration ? event.duration.toFixed(1) + ' hrs' : 'N/A', col2X + 20, y);
        y += 8;
        
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y - 4, contentWidth, 10, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin, y - 4, contentWidth, 10, 'S');
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Overall Grade:', col1X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(eventScore?.outcome || 'Not Assessed', col1X + 30, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Result:', col2X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(eventScore?.outcome === 'Pass' ? 'PASS' : eventScore?.outcome === 'Fail' ? 'FAIL' : 'N/A', col2X + 15, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('DCO:', col2X + 40, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(eventScore?.outcome === 'DCO' ? 'Yes' : 'No', col2X + 50, y);
        y += 12;
        
        // Add Weather, NEST, Profile, Overall comment boxes
        pdf.setFontSize(8);
        const boxHeight = 12;
        const boxY = y;
        
        // Weather box (left)
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, boxY, contentWidth / 2 - 2, boxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin, boxY, contentWidth / 2 - 2, boxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Weather:', margin + 2, boxY + 4);
        pdf.setFont('helvetica', 'normal');
        const weatherText = pdf.splitTextToSize(commentSections.Weather || 'N/A', contentWidth / 2 - 6);
        pdf.text(weatherText, margin + 2, boxY + 8);
        
        // NEST box (right)
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin + contentWidth / 2 + 2, boxY, contentWidth / 2 - 2, boxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin + contentWidth / 2 + 2, boxY, contentWidth / 2 - 2, boxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.text('NEST:', margin + contentWidth / 2 + 4, boxY + 4);
        pdf.setFont('helvetica', 'normal');
        const nestText = pdf.splitTextToSize(commentSections.NEST || 'N/A', contentWidth / 2 - 6);
        pdf.text(nestText, margin + contentWidth / 2 + 4, boxY + 8);
        
        y += boxHeight + 2;
        
        // Profile box (left)
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y, contentWidth / 2 - 2, boxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin, y, contentWidth / 2 - 2, boxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.text('Profile:', margin + 2, y + 4);
        pdf.setFont('helvetica', 'normal');
        const profileText = pdf.splitTextToSize(commentSections.Profile || 'N/A', contentWidth / 2 - 6);
        pdf.text(profileText, margin + 2, y + 8);
        
        // Overall comment box (right)
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin + contentWidth / 2 + 2, y, contentWidth / 2 - 2, boxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin + contentWidth / 2 + 2, y, contentWidth / 2 - 2, boxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.text('Overall:', margin + contentWidth / 2 + 4, y + 4);
        pdf.setFont('helvetica', 'normal');
        const overallText = pdf.splitTextToSize(commentSections.Overall || 'N/A', contentWidth / 2 - 6);
        pdf.text(overallText, margin + contentWidth / 2 + 4, y + 8);
        
        y += boxHeight + 4;
        
        pdf.setFillColor(31, 41, 55);
        pdf.rect(margin, y - 4, contentWidth, 7, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text('Category / Element', margin + 2, y);
        pdf.text('Grade', margin + 80, y);
        pdf.text('Comments', margin + 100, y);
        y += 5;
        
        pdf.setTextColor(0, 0, 0);
        
        // Grade color mapping (matching Performance History page)
        const gradeColors: {[key: string]: [number, number, number]} = {
            '0': [220, 38, 38],   // Red
            '1': [234, 88, 12],   // Orange-red
            '2': [245, 158, 11],  // Orange
            '3': [234, 179, 8],   // Yellow
            '4': [132, 204, 22],  // Light green
            '5': [34, 197, 94]    // Green
        };
        
        pdf.setFontSize(7);
        pt051Structure.forEach(cat => {
            pdf.setFillColor(229, 231, 235);
            pdf.rect(margin, y - 3, contentWidth, 5, 'F');
            pdf.setDrawColor(156, 163, 175);
            pdf.rect(margin, y - 3, contentWidth, 5, 'S');
            pdf.setFont('helvetica', 'bold');
            pdf.text(cat.category, margin + 2, y);
            y += 5;
            
            pdf.setFont('helvetica', 'normal');
            cat.elements.forEach(elem => {
                // Draw element row border
                pdf.setDrawColor(209, 213, 219);
                pdf.rect(margin, y - 3, contentWidth, 5, 'S');
                
                // Element name
                pdf.text('  ' + elem, margin + 2, y);
                
                // Grade cell with color background
                const grade = '3'; // Sample grade
                const gradeColor = gradeColors[grade] || [243, 244, 246];
                
                // Draw colored grade cell
                pdf.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
                pdf.rect(margin + 78, y - 3, 15, 5, 'F');
                pdf.setDrawColor(209, 213, 219);
                pdf.rect(margin + 78, y - 3, 15, 5, 'S');
                
                // Draw grade text
                pdf.setTextColor(255, 255, 255); // White text on colored background
                pdf.text(grade, margin + 84, y);
                pdf.setTextColor(0, 0, 0); // Reset to black
                
                // Comments
                pdf.text('-', margin + 102, y);
                y += 5;
            });
        });
        
        y += 3;
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('QFI Comments:', margin, y);
        y += 5;
        
        pdf.setDrawColor(209, 213, 219);
        pdf.rect(margin, y - 3, contentWidth, 20, 'S');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        const comments = eventScore?.comments || 'No comments provided';
        const splitComments = pdf.splitTextToSize(comments, contentWidth - 4);
        pdf.text(splitComments, margin + 2, y);
    };
    
    const renderPT051ForEvent = (event: ScheduleEvent): string => {
        const trainee = allTrainees.find(t => t.fullName === event.student || t.fullName === event.pilot);
        const instructor = allInstructors.find(i => i.name === event.instructor);
        
        // Get scores for this event
        const traineeScores = scores.get(event.student || event.pilot || '');
        const eventScore = traineeScores?.find(s => s.syllabusId === event.flightNumber && s.date === event.date);
        
        // PT051 structure with all elements
        const pt051Structure = [
            { category: 'Core Dimensions', elements: ['Airmanship', 'Preparation', 'Technique'] },
            { category: 'Procedural Framework', elements: ['Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks'] },
            { category: 'Takeoff', elements: ['Stationary'] },
            { category: 'Departure', elements: ['Visual'] },
            { category: 'Core Handling Skills', elements: ['Effects of Control', 'Trimming', 'Straight and Level'] },
            { category: 'Turns', elements: ['Level medium Turn', 'Level Steep turn'] },
            { category: 'Recovery', elements: ['Visual - Initial & Pitch'] },
            { category: 'Landing', elements: ['Landing', 'Crosswind'] },
            { category: 'Domestics', elements: ['Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'] }
        ];
        
        const gradeColors: {[key: string]: string} = {
            '0': '#dc2626', '1': '#ea580c', '2': '#f59e0b', 
            '3': '#eab308', '4': '#84cc16', '5': '#22c55e'
        };
        
        return `
            <div style="font-family: Arial, sans-serif; padding: 10px; background: white; color: black; font-size: 9px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 8px; border-bottom: 2px solid black; padding-bottom: 5px;">
                    <h1 style="margin: 0; font-size: 16px; font-weight: bold;">RAAF PT-051 Training Assessment</h1>
                </div>
                
                <!-- Info Grid - Compact 2-column layout -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; border: 1px solid black; padding: 6px; background: #f9fafb;">
                    <div><strong>Trainee:</strong> ${trainee?.rank || ''} ${trainee?.name || event.student || event.pilot || 'N/A'}</div>
                    <div><strong>Course:</strong> ${trainee?.course || 'N/A'}</div>
                    <div><strong>Instructor:</strong> ${instructor?.rank || ''} ${instructor?.name || event.instructor || 'N/A'}</div>
                    <div><strong>Date:</strong> ${event.date || 'N/A'}</div>
                    <div><strong>Flight:</strong> ${event.flightNumber || 'N/A'}</div>
                    <div><strong>Duration:</strong> ${event.duration ? event.duration.toFixed(1) + ' hrs' : 'N/A'}</div>
                </div>
                
                <!-- Overall Assessment -->
                <div style="border: 1px solid black; padding: 6px; margin-bottom: 8px; background: #f3f4f6;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                        <div><strong>Overall Grade:</strong> ${eventScore?.outcome || 'Not Assessed'}</div>
                        <div><strong>Result:</strong> ${eventScore?.outcome === 'Pass' ? 'PASS' : eventScore?.outcome === 'Fail' ? 'FAIL' : 'N/A'}</div>
                        <div><strong>DCO:</strong> ${eventScore?.outcome === 'DCO' ? 'Yes' : 'No'}</div>
                    </div>
                </div>
                
                <!-- Assessment Grid - Compact layout -->
                <div style="border: 1px solid black; margin-bottom: 8px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 8px;">
                        <thead>
                            <tr style="background: #1f2937; color: white;">
                                <th style="border: 1px solid #374151; padding: 4px; text-align: left; width: 30%;">Category / Element</th>
                                <th style="border: 1px solid #374151; padding: 4px; text-align: center; width: 10%;">Grade</th>
                                <th style="border: 1px solid #374151; padding: 4px; text-align: left;">Comments</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pt051Structure.map(cat => `
                                <tr style="background: #e5e7eb;">
                                    <td colspan="3" style="border: 1px solid #9ca3af; padding: 3px; font-weight: bold;">${cat.category}</td>
                                </tr>
                                ${cat.elements.map(elem => `
                                    <tr>
                                        <td style="border: 1px solid #d1d5db; padding: 3px; padding-left: 12px;">${elem}</td>
                                        <td style="border: 1px solid #d1d5db; padding: 3px; text-align: center; background: ${gradeColors['3'] || '#f3f4f6'};">3</td>
                                        <td style="border: 1px solid #d1d5db; padding: 3px; font-size: 7px;">-</td>
                                    </tr>
                                `).join('')}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <!-- Comments Section - Compact -->
                <div style="border: 1px solid black; padding: 6px;">
                    <div style="margin-bottom: 4px;"><strong>QFI Comments:</strong></div>
                    <div style="border: 1px solid #d1d5db; padding: 4px; min-height: 30px; background: #f9fafb; font-size: 8px;">
                        ${eventScore?.comments || 'No comments provided'}
                    </div>
                </div>
            </div>
        `;
    };
    
    

    // Handle save template
    const handleSaveTemplate = () => {
        if (!templateName.trim()) {
            alert('Please enter a template name');
            return;
        }

        const template: ExportTemplate = {
            name: templateName,
            recordType,
            timePeriod,
            singleDate,
            startDate,
            endDate,
            outputFormat,
            selectedTrainees,
            selectedStaff,
            selectedCourses,
            selectedEventTypes,
            statusFilter,
            remedialFilter
        };

        setSavedTemplates([...savedTemplates, template]);
        setTemplateName('');
        alert(`Template "${template.name}" saved successfully!`);
    };

    // Handle load template
    const handleLoadTemplate = (template: ExportTemplate) => {
        setRecordType(template.recordType);
        setTimePeriod(template.timePeriod);
        setSingleDate(template.singleDate);
        setStartDate(template.startDate);
        setEndDate(template.endDate);
        setOutputFormat(template.outputFormat);
        setSelectedTrainees(template.selectedTrainees);
        setSelectedStaff(template.selectedStaff);
        setSelectedCourses(template.selectedCourses);
        setSelectedEventTypes(template.selectedEventTypes);
        setStatusFilter(template.statusFilter);
        setRemedialFilter(template.remedialFilter);
        setShowTemplates(false);
    };

    return (
        <div className="h-full overflow-auto bg-gray-900 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h1 className="text-2xl font-bold text-white mb-2">Export Training Records</h1>
                    <p className="text-gray-400">
                        Export PT051 training records for printing or official record keeping.
                        Select your options below and preview before exporting.
                    </p>
                </div>

                {/* Question 1: What records? */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">What records do you want to export?</h2>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'all'}
                                onChange={() => setRecordType('all')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">All records (Trainees, Staff, and Events)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'trainees'}
                                onChange={() => setRecordType('trainees')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Trainee records only</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'staff'}
                                onChange={() => setRecordType('staff')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Staff records only</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'events'}
                                onChange={() => setRecordType('events')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Event records only</span>
                        </label>
                    </div>
                </div>

                {/* Question 2: Time period? */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">For what period?</h2>
                    <div className="space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={timePeriod === 'all-time'}
                                onChange={() => setTimePeriod('all-time')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">All time</span>
                        </label>
                        
                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    checked={timePeriod === 'single-date'}
                                    onChange={() => setTimePeriod('single-date')}
                                    className="w-4 h-4 text-sky-500"
                                />
                                <span className="text-gray-200">Single date</span>
                            </label>
                            {timePeriod === 'single-date' && (
                                <input
                                    type="date"
                                    value={singleDate}
                                    onChange={(e) => setSingleDate(e.target.value)}
                                    className="ml-7 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                />
                            )}
                        </div>

                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    checked={timePeriod === 'date-range'}
                                    onChange={() => setTimePeriod('date-range')}
                                    className="w-4 h-4 text-sky-500"
                                />
                                <span className="text-gray-200">Date range</span>
                            </label>
                            {timePeriod === 'date-range' && (
                                <div className="ml-7 flex items-center space-x-3">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        placeholder="Start date"
                                    />
                                    <span className="text-gray-400">to</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        placeholder="End date"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Question 3: Output format */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">What format?</h2>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'pdf'}
                                onChange={() => setOutputFormat('pdf')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">PDF (recommended for printing and filing)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'excel'}
                                onChange={() => setOutputFormat('excel')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Excel (for further analysis)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'csv'}
                                onChange={() => setOutputFormat('csv')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">CSV (for data import)</span>
                        </label>
                    </div>
                </div>

                {/* Optional filters */}
                <div className="bg-gray-800 rounded-lg border border-gray-700">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full p-6 flex items-center justify-between text-left"
                    >
                        <h2 className="text-lg font-semibold text-white">
                            Do you want to narrow it down? <span className="text-gray-500 text-sm font-normal">(optional)</span>
                        </h2>
                        <span className="text-gray-400">{showFilters ? '▼' : '▶'}</span>
                    </button>
                    
                    {showFilters && (
                        <div className="px-6 pb-6 space-y-6 border-t border-gray-700 pt-6">
                            {/* Event types */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Event Types</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['Flight', 'FTD', 'CPT', 'Ground'] as EventType[]).map(type => (
                                        <label key={type} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedEventTypes.includes(type)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedEventTypes([...selectedEventTypes, type]);
                                                    } else {
                                                        setSelectedEventTypes(selectedEventTypes.filter(t => t !== type));
                                                    }
                                                }}
                                                className="w-4 h-4 text-sky-500"
                                            />
                                            <span className="text-gray-200">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Status (PT051 Outcome)</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'all'}
                                            onChange={() => setStatusFilter('all')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">All</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'dco'}
                                            onChange={() => setStatusFilter('dco')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">DCO (Duty Carried Out)</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'dnco'}
                                            onChange={() => setStatusFilter('dnco')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">DNCO (Duty Not Carried Out)</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'pass'}
                                            onChange={() => setStatusFilter('pass')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Pass</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'fail'}
                                            onChange={() => setStatusFilter('fail')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Fail</span>
                                    </label>
                                </div>
                            </div>

                            {/* Remedial */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Remedial</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'all'}
                                            onChange={() => setRemedialFilter('all')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">All</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'yes'}
                                            onChange={() => setRemedialFilter('yes')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Remedial only</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'no'}
                                            onChange={() => setRemedialFilter('no')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Non-remedial only</span>
                                    </label>
                                </div>
                            </div>

                            {/* Courses */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Courses (Active & Archived)</h3>
                                <input
                                    type="text"
                                    placeholder="Search courses..."
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                    className="w-full px-3 py-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                                />
                                <select
                                    multiple
                                    value={selectedCourses}
                                    onChange={(e) => {
                                        const options = Array.from(e.target.selectedOptions, option => option.value);
                                        setSelectedCourses(options);
                                    }}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                    size={5}
                                >
                                    {filteredCourses.map(courseName => (
                                        <option key={courseName} value={courseName}>
                                            {courseName} {archivedCourses[courseName] ? '(Archived)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                            </div>

                            {/* Specific trainees */}
                            {(recordType === 'all' || recordType === 'trainees') && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-3">Specific Trainees (Active & Archived)</h3>
                                    <input
                                        type="text"
                                        placeholder="Search trainees..."
                                        value={traineeSearch}
                                        onChange={(e) => setTraineeSearch(e.target.value)}
                                        className="w-full px-3 py-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                                    />
                                    <select
                                        multiple
                                        value={selectedTrainees}
                                        onChange={(e) => {
                                            const options = Array.from(e.target.selectedOptions, option => option.value);
                                            setSelectedTrainees(options);
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        size={5}
                                    >
                                        {filteredTrainees.map(trainee => (
                                            <option key={trainee.name} value={trainee.name}>
                                                {trainee.rank} {trainee.name} ({trainee.course}) {trainee.isPaused ? '(Archived)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                </div>
                            )}

                            {/* Specific staff */}
                            {(recordType === 'all' || recordType === 'staff') && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-3">Specific Staff (Active & Archived)</h3>
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={staffSearch}
                                        onChange={(e) => setStaffSearch(e.target.value)}
                                        className="w-full px-3 py-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                                    />
                                    <select
                                        multiple
                                        value={selectedStaff}
                                        onChange={(e) => {
                                            const options = Array.from(e.target.selectedOptions, option => option.value);
                                            setSelectedStaff(options);
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        size={5}
                                    >
                                        {filteredStaff.map(instructor => (
                                            <option key={instructor.name} value={instructor.name}>
                                                {instructor.rank} {instructor.name} {instructor.isPaused ? '(Archived)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Export Summary */}
                <div className="bg-sky-900/30 rounded-lg p-6 border border-sky-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Export Summary</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-400">Record Type:</span>
                            <p className="text-white font-medium">{getRecordTypeDescription()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Time Period:</span>
                            <p className="text-white font-medium">{getTimePeriodDescription()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Output Format:</span>
                            <p className="text-white font-medium">{outputFormat.toUpperCase()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Estimated Size:</span>
                            <p className="text-white font-medium">{estimatedSize}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-sky-700">
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold text-white">Total Records:</span>
                            <span className="text-2xl font-bold text-sky-400">{recordCount}</span>
                        </div>
                        {isLargeExport && (
                            <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
                                <p className="text-yellow-200 text-sm">
                                    ⚠️ Large export ({recordCount} records). This may take a few moments to generate.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview Table */}
                {recordCount > 0 && (
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-lg font-semibold text-white mb-4">Preview (first 5 records)</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-gray-700 text-gray-300">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Event</th>
                                        <th className="px-4 py-2">Trainee</th>
                                        <th className="px-4 py-2">Instructor</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.events.slice(0, 5).map((event, idx) => (
                                        <tr key={idx} className="border-b border-gray-700">
                                            <td className="px-4 py-2 text-gray-300">{formatDate(event.date)}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.type}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.flightNumber}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.student || event.pilot || '-'}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.instructor || '-'}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    event.isCancelled ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'
                                                }`}>
                                                    {event.isCancelled ? 'Cancelled' : 'Completed'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredData.events.length > 5 && (
                                <p className="text-gray-500 text-sm mt-2">
                                    ... and {filteredData.events.length - 5} more records
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleExport}
                                disabled={recordCount === 0}
                                className={`px-6 py-3 rounded font-semibold ${
                                    recordCount === 0
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-sky-600 hover:bg-sky-700 text-white'
                                }`}
                            >
                                Export {outputFormat.toUpperCase()}
                            </button>
                            <button
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded"
                            >
                                Templates
                            </button>
                        </div>
                        {recordCount === 0 && (
                            <p className="text-yellow-400 text-sm">
                                No records match your criteria. Please adjust your filters.
                            </p>
                        )}
                    </div>

                    {/* Template Management */}
                    {showTemplates && (
                        <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-2">Save Current Settings as Template</h3>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="Template name"
                                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                    />
                                    <button
                                        onClick={handleSaveTemplate}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            {savedTemplates.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-2">Saved Templates</h3>
                                    <div className="space-y-2">
                                        {savedTemplates.map((template, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                                                <span className="text-white">{template.name}</span>
                                                <button
                                                    onClick={() => handleLoadTemplate(template)}
                                                    className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm"
                                                >
                                                    Load
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Export Progress Indicator */}
            {isExporting && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
                    <div className="bg-gray-800 border-2 border-sky-500 rounded-lg shadow-2xl p-8 min-w-[500px]">
                        <div className="text-center mb-6">
                            <h3 className="text-sky-400 font-bold text-xl mb-2">Exporting Records...</h3>
                            <p className="text-gray-300 text-base">{exportStatus}</p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mb-4">
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                <div 
                                    className="bg-sky-500 h-full transition-all duration-300 flex items-center justify-center text-xs font-bold text-white"
                                    style={{ width: `${exportProgress}%` }}
                                >
                                    {exportProgress > 10 && `${exportProgress}%`}
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-center text-gray-400 text-sm">
                            Please wait... This may take a few moments.
                        </div>
                    </div>
                </div>
            )}
            
            {/* Export Success Message */}
            {showExportSuccess && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-800 border-2 border-green-500 rounded-lg shadow-2xl p-6 min-w-[400px]">
                    <div className="flex items-start gap-4">
                        <div className="text-green-400 text-3xl">✓</div>
                        <div className="flex-1">
                            <h3 className="text-green-400 font-bold text-lg mb-2">Export Successful!</h3>
                            <p className="text-gray-200 text-base mb-2">
                                Your file has been downloaded successfully.
                            </p>
                            <div className="bg-gray-700/50 rounded p-3 text-sm">
                                <div className="text-gray-300">
                                    <strong>Format:</strong> {outputFormat.toUpperCase()}
                                </div>
                                <div className="text-gray-300">
                                    <strong>Records:</strong> {recordCount}
                                </div>
                                <div className="text-gray-300">
                                    <strong>File:</strong> training_records_{new Date().toISOString().split('T')[0]}.{outputFormat}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Export Error Message */}
            {showExportError && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-800 border-2 border-red-500 rounded-lg shadow-2xl p-6 min-w-[400px]">
                    <div className="flex items-start gap-4">
                        <div className="text-red-400 text-3xl">✗</div>
                        <div className="flex-1">
                            <h3 className="text-red-400 font-bold text-lg mb-2">Export Failed</h3>
                            <p className="text-gray-200 text-base mb-2">
                                There was an error exporting your data.
                            </p>
                            <p className="text-gray-300 text-sm">
                                Please check the browser console for details and try again.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingRecordsExportView;