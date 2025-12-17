
import React, { useState, useMemo } from 'react';
import { Instructor, Trainee, ScheduleEvent, LogbookExperience } from '../types';
import AuditButton from './AuditButton';
import { getAllFiles, getFile } from '../utils/db';

interface LogbookViewProps {
  person: Instructor | Trainee;
  events: ScheduleEvent[];
  onBack: () => void;
}

declare var jspdf: any;

const LogbookView: React.FC<LogbookViewProps> = ({ person, events, onBack }) => {
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const startYearStr = `${today.getFullYear()}-01`;

  const [startMonth, setStartMonth] = useState(startYearStr);
  const [endMonth, setEndMonth] = useState(currentMonthStr);
  
  const personName = 'fullName' in person ? person.fullName : person.name;
  const personRole = 'role' in person ? 'Instructor' : 'Trainee';

  // Filter events for the selected date range (for display table)
  const filteredEvents = useMemo(() => {
    if (!startMonth || !endMonth) return [];
    
    const start = new Date(`${startMonth}-01`);
    const end = new Date(`${endMonth}-01`);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // Last day of month

    return events.filter(event => {
      if (event.type !== 'flight' && event.type !== 'ftd') return false;

      const isInvolved = 
        event.instructor === personName || 
        event.student === personName || 
        event.pilot === personName || 
        event.attendees?.includes(personName);

      if (!isInvolved) return false;

      const eventDate = new Date(event.date);
      return eventDate >= start && eventDate <= end;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Descending for display
  }, [events, personName, startMonth, endMonth]);

  const formatHours = (hours: number) => {
      return (hours && hours > 0.01) ? hours.toFixed(1) : '-';
  };

  // Helper to calculate fields for a single row
  const calculateRowData = (event: ScheduleEvent) => {
    const isFlight = event.type === 'flight';
    const isFtd = event.type === 'ftd';
    const duration = event.duration;
    
    const isNight = event.startTime >= 18.0;

    let dayP1 = 0, dayP2 = 0, dayDual = 0;
    let nightP1 = 0, nightP2 = 0, nightDual = 0;
    let simP1 = 0, simP2 = 0, simDual = 0, simTotal = 0;
    let instructorTime = 0;
    let captainTime = 0;

    if (isFlight) {
        if (personRole === 'Instructor') {
            // Instructor
            if (event.flightType === 'Dual') {
                instructorTime = duration;
                captainTime = duration; 
                if (isNight) nightP1 = duration; else dayP1 = duration;
            } else {
                // Solo/Mutual - if acting as Captain
                 captainTime = duration;
                 if (isNight) nightP1 = duration; else dayP1 = duration;
            }
        } else {
            // Trainee
            if (event.flightType === 'Solo') {
                captainTime = duration; // Trainee Solo is Captain/P1
                if (isNight) nightP1 = duration; else dayP1 = duration;
            } else {
                // Dual
                if (isNight) nightDual = duration; else dayDual = duration;
            }
        }
    } else if (isFtd) {
        simTotal = duration;
        if (personRole === 'Instructor') {
            instructorTime = duration;
            simP1 = duration; // Instructor in Sim usually logs P1/Instructor
        } else {
            simDual = duration; // Trainee in Sim logs Dual
        }
    }

    return {
        date: event.date,
        type: isFlight ? 'PC-21' : (isFtd ? 'FTD' : 'Ground'),
        tail: isFlight ? (event.resourceId.includes('PC-21') ? `A54-${event.resourceId.split(' ')[1].padStart(3,'0')}` : 'A54-XXX') : event.resourceId,
        captain: (event.instructor || event.pilot || 'Self').split(' – ')[0].split(',')[0],
        crew: (event.student || (event.flightType === 'Solo' ? 'Solo' : '')).split(' – ')[0].split(',')[0],
        duty: `${event.origin || 'ESL'}-${event.destination || 'ESL'} : ${event.flightNumber}`,
        dayP1, dayP2, dayDual,
        nightP1, nightP2, nightDual,
        total: isFlight ? duration : 0,
        captainTime,
        instructorTime,
        simP1, simP2, simDual, simTotal,
        simActual: 0, app2D: 0, app3D: 0,
        ifSim: 0 
    };
  };

  const handleGeneratePdf = async () => {
      // 1. Check if template exists
      const files = await getAllFiles();
      const hasTemplate = files.some(f => f.name.includes('Logbook') && f.folderId === 'logbook_templates');
      if (!hasTemplate) console.warn("Logbook Template file not found.");

      // 2. Initialize with Baseline (from File) - This is the "Prior Experience"
      let runningTotals = {
          dayP1: 0, dayP2: 0, dayDual: 0,
          nightP1: 0, nightP2: 0, nightDual: 0,
          total: 0, captainTime: 0, instructorTime: 0,
          simP1: 0, simP2: 0, simDual: 0, simTotal: 0,
          simActual: 0, app2D: 0, app3D: 0
      };

      const folderId = personRole === 'Instructor' ? 'staff_logbook' : 'trainee_logbook';
      const cleanName = person.name.replace(/,\s/g, '_'); 
      const fileName = `Logbook_${cleanName}_${person.idNumber}.json`;
      
      const existingLogbookFile = files.find(f => f.name === fileName && f.folderId === folderId);

      if (existingLogbookFile) {
          try {
              const fileRecord = await getFile(existingLogbookFile.id);
              if (fileRecord) {
                  const text = await fileRecord.content.text();
                  const logbookData: LogbookExperience = JSON.parse(text);
                  
                  runningTotals = {
                      dayP1: logbookData.day.p1 || 0,
                      dayP2: logbookData.day.p2 || 0,
                      dayDual: logbookData.day.dual || 0,
                      nightP1: logbookData.night.p1 || 0,
                      nightP2: logbookData.night.p2 || 0,
                      nightDual: logbookData.night.dual || 0,
                      total: logbookData.total || 0,
                      captainTime: logbookData.captain || 0,
                      instructorTime: logbookData.instructor || 0,
                      simP1: logbookData.simulator.p1 || 0,
                      simP2: logbookData.simulator.p2 || 0,
                      simDual: logbookData.simulator.dual || 0,
                      simTotal: logbookData.simulator.total || 0,
                      simActual: logbookData.instrument.actual || 0,
                      app2D: 0, app3D: 0
                  };
              }
          } catch (e) { console.error("Error reading logbook file:", e); }
      }

      // 3. Chronologically Add ALL events from schedule history
      const allPersonEvents = events.filter(e => 
        (e.type === 'flight' || e.type === 'ftd') &&
        (e.instructor === personName || e.student === personName || e.pilot === personName || e.attendees?.includes(personName))
      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Oldest first

      const rangeStartDate = new Date(`${startMonth}-01`);
      const rangeEndDate = new Date(`${endMonth}-01`);
      rangeEndDate.setMonth(rangeEndDate.getMonth() + 1);
      rangeEndDate.setDate(0);

      // Events to be printed
      const eventsToPrint: ScheduleEvent[] = [];

      allPersonEvents.forEach(event => {
          const eventDate = new Date(event.date);
          if (eventDate < rangeStartDate) {
              // Event is BEFORE the print range: Add to Running Totals (Brought Forward)
              const d = calculateRowData(event);
              runningTotals.dayP1 += d.dayP1; runningTotals.dayP2 += d.dayP2; runningTotals.dayDual += d.dayDual;
              runningTotals.nightP1 += d.nightP1; runningTotals.nightP2 += d.nightP2; runningTotals.nightDual += d.nightDual;
              runningTotals.total += d.total; runningTotals.captainTime += d.captainTime; runningTotals.instructorTime += d.instructorTime;
              runningTotals.simP1 += d.simP1; runningTotals.simP2 += d.simP2; runningTotals.simDual += d.simDual; runningTotals.simTotal += d.simTotal;
              runningTotals.simActual += d.simActual;
          } else if (eventDate <= rangeEndDate) {
              // Event is WITHIN the print range: Add to list for PDF generation
              eventsToPrint.push(event);
          }
      });


      // 4. Generate PDF
      if (typeof jspdf === 'undefined') { alert('PDF library not loaded.'); return; }

      const { jsPDF } = jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Group events within range by month
      const eventsByMonth: Record<string, ScheduleEvent[]> = {};
      eventsToPrint.forEach(event => {
          const dateObj = new Date(event.date);
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          if (!eventsByMonth[key]) eventsByMonth[key] = [];
          eventsByMonth[key].push(event);
      });
      
      const sortedMonths = Object.keys(eventsByMonth).sort();

      if (sortedMonths.length === 0 && startMonth) {
           sortedMonths.push(startMonth);
      }

      sortedMonths.forEach((monthKey, index) => {
          if (index > 0) doc.addPage();
          
          // Title
          doc.setFontSize(14);
          doc.setTextColor(0, 0, 0);
          doc.text(`Logbook: ${person.rank} ${personName}`, 14, 15);
          doc.setFontSize(10);
          const [y, m] = monthKey.split('-');
          const monthName = new Date(Date.UTC(parseInt(y), parseInt(m)-1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
          doc.text(`Period: ${monthName}`, 14, 20);

          // Totals Brought Forward Row
          const bfRow = [
               { content: 'Totals brought Forward', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, 
               formatHours(runningTotals.dayP1), formatHours(runningTotals.dayP2), formatHours(runningTotals.dayDual),
               formatHours(runningTotals.nightP1), formatHours(runningTotals.nightP2), formatHours(runningTotals.nightDual),
               formatHours(runningTotals.total), formatHours(runningTotals.captainTime), formatHours(runningTotals.instructorTime),
               '', formatHours(runningTotals.simActual), '', '',
               formatHours(runningTotals.simP1), formatHours(runningTotals.simP2), formatHours(runningTotals.simDual), formatHours(runningTotals.simTotal)
          ];

          const monthEvents = eventsByMonth[monthKey] || [];
          const monthTotals = { dayP1: 0, dayP2: 0, dayDual: 0, nightP1: 0, nightP2: 0, nightDual: 0, total: 0, captainTime: 0, instructorTime: 0, simP1: 0, simP2: 0, simDual: 0, simTotal: 0, simActual: 0 };

          const tableBody = monthEvents.map(event => {
              const d = calculateRowData(event);
              monthTotals.dayP1 += d.dayP1; monthTotals.dayP2 += d.dayP2; monthTotals.dayDual += d.dayDual;
              monthTotals.nightP1 += d.nightP1; monthTotals.nightP2 += d.nightP2; monthTotals.nightDual += d.nightDual;
              monthTotals.total += d.total; monthTotals.captainTime += d.captainTime; monthTotals.instructorTime += d.instructorTime;
              monthTotals.simP1 += d.simP1; monthTotals.simP2 += d.simP2; monthTotals.simDual += d.simDual; monthTotals.simTotal += d.simTotal;
              monthTotals.simActual += d.simActual;

              const dateObj = new Date(event.date);
              const year = dateObj.getFullYear().toString().slice(-2);
              const dateShort = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    
              return [
                  year, dateShort, d.type, d.tail, d.captain, d.crew, d.duty,
                  formatHours(d.dayP1), formatHours(d.dayP2), formatHours(d.dayDual),
                  formatHours(d.nightP1), formatHours(d.nightP2), formatHours(d.nightDual),
                  formatHours(d.total), formatHours(d.captainTime), formatHours(d.instructorTime),
                  '', formatHours(d.simActual), d.app2D > 0 ? d.app2D : '', d.app3D > 0 ? d.app3D : '',
                  formatHours(d.simP1), formatHours(d.simP2), formatHours(d.simDual), formatHours(d.simTotal)
              ];
          });

          // Update Running Totals for next page / Grand Total
          runningTotals.dayP1 += monthTotals.dayP1; runningTotals.dayP2 += monthTotals.dayP2; runningTotals.dayDual += monthTotals.dayDual;
          runningTotals.nightP1 += monthTotals.nightP1; runningTotals.nightP2 += monthTotals.nightP2; runningTotals.nightDual += monthTotals.nightDual;
          runningTotals.total += monthTotals.total; runningTotals.captainTime += monthTotals.captainTime; runningTotals.instructorTime += monthTotals.instructorTime;
          runningTotals.simP1 += monthTotals.simP1; runningTotals.simP2 += monthTotals.simP2; runningTotals.simDual += monthTotals.simDual; runningTotals.simTotal += monthTotals.simTotal;
          runningTotals.simActual += monthTotals.simActual;

          const totalRow = [
              '', 'MONTH TOTAL', '', '', '', '', '',
              formatHours(monthTotals.dayP1), formatHours(monthTotals.dayP2), formatHours(monthTotals.dayDual),
              formatHours(monthTotals.nightP1), formatHours(monthTotals.nightP2), formatHours(monthTotals.nightDual),
              formatHours(monthTotals.total), formatHours(monthTotals.captainTime), formatHours(monthTotals.instructorTime),
              '', formatHours(monthTotals.simActual), '', '',
              formatHours(monthTotals.simP1), formatHours(monthTotals.simP2), formatHours(monthTotals.simDual), formatHours(monthTotals.simTotal)
          ];
          
          const grandTotalRow = [
              '', 'GRAND TOTAL', '', '', '', '', '',
              formatHours(runningTotals.dayP1), formatHours(runningTotals.dayP2), formatHours(runningTotals.dayDual),
              formatHours(runningTotals.nightP1), formatHours(runningTotals.nightP2), formatHours(runningTotals.nightDual),
              formatHours(runningTotals.total), formatHours(runningTotals.captainTime), formatHours(runningTotals.instructorTime),
              '', formatHours(runningTotals.simActual), '', '',
              formatHours(runningTotals.simP1), formatHours(runningTotals.simP2), formatHours(runningTotals.simDual), formatHours(runningTotals.simTotal)
          ];

          doc.autoTable({
              startY: 25,
              head: [
                  [
                      { content: 'Year', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Date', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Type', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Tail\n(Mark)', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Captain', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Co-Pilot /\n2nd Pilot /\nCrew', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Duty', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Day Flying', colSpan: 3, styles: { halign: 'center' } },
                      { content: 'Night Flying', colSpan: 3, styles: { halign: 'center' } },
                      { content: 'TOTAL', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Captain', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Instructor', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Sim', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Actual', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: '2D App', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: '3D App', rowSpan: 2, styles: { valign: 'middle' } },
                      { content: 'Simulator', colSpan: 4, styles: { halign: 'center' } },
                  ],
                  [
                      { content: 'P1', styles: { halign: 'center' } },
                      { content: 'P2', styles: { halign: 'center' } },
                      { content: 'Dual', styles: { halign: 'center' } },
                      { content: 'P1', styles: { halign: 'center' } },
                      { content: 'P2', styles: { halign: 'center' } },
                      { content: 'Dual', styles: { halign: 'center' } },
                      { content: 'TOTAL', styles: { halign: 'center' } },
                      { content: 'P1', styles: { halign: 'center' } },
                      { content: 'P2', styles: { halign: 'center' } },
                      { content: 'Dual', styles: { halign: 'center' } },
                      { content: 'TOTAL', styles: { halign: 'center' } }
                  ]
              ],
              body: [ bfRow, ...tableBody, totalRow, grandTotalRow ],
              theme: 'grid',
              styles: { fontSize: 7, cellPadding: 1, lineColor: [150, 150, 150], lineWidth: 0.1 },
              headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
              footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
              columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 12 }, 2: { cellWidth: 12 }, 3: { cellWidth: 15 }, 4: { cellWidth: 20 }, 5: { cellWidth: 20 }, 6: { cellWidth: 25 } }
          });
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-white">Logbook: {personName}</h1>
          <p className="text-sm text-gray-400">{personRole} - {person.rank}</p>
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-400">From:</label>
                <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:ring-sky-500" style={{colorScheme: 'dark'}} />
                <label className="text-sm text-gray-400">To:</label>
                <input type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:ring-sky-500" style={{colorScheme: 'dark'}} />
            </div>
            <button onClick={handleGeneratePdf} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md flex items-center space-x-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
               <span>Print</span>
            </button>
            <button onClick={onBack} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md">
                &larr; Back
            </button>
               <AuditButton pageName="Logbook" />
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700 text-sm whitespace-nowrap">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tail</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Captain/Inst</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Crew/Trainee</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Duty</th>
                        
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Day P1</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Day P2</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Day Dual</th>
                        
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Night P1</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Night P2</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Night Dual</th>

                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Total</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Captain</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Instructor</th>
                        
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">IF Sim</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">IF Actual</th>
                        
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Sim P1</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Sim P2</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Sim Dual</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Sim Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {filteredEvents.map(event => {
                        const data = calculateRowData(event);
                        return (
                            <tr key={event.id} className="hover:bg-gray-700/30">
                                <td className="px-4 py-3 text-gray-300">{data.date}</td>
                                <td className="px-4 py-3 text-white font-medium">{data.type}</td>
                                <td className="px-4 py-3 text-gray-400 font-mono">{data.tail}</td>
                                <td className="px-4 py-3 text-gray-300 truncate max-w-[100px]" title={data.captain}>{data.captain}</td>
                                <td className="px-4 py-3 text-gray-300 truncate max-w-[100px]" title={data.crew}>{data.crew}</td>
                                <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[150px]" title={data.duty}>{data.duty}</td>
                                
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.dayP1)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.dayP2)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.dayDual)}</td>
                                
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.nightP1)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.nightP2)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.nightDual)}</td>
                                
                                <td className="px-2 py-3 text-center font-bold text-sky-400 font-mono">{formatHours(data.total)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.captainTime)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.instructorTime)}</td>
                                
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.ifSim)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.simActual)}</td>

                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.simP1)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.simP2)}</td>
                                <td className="px-2 py-3 text-center text-gray-300 font-mono">{formatHours(data.simDual)}</td>
                                <td className="px-2 py-3 text-center text-indigo-400 font-mono font-bold">{formatHours(data.simTotal)}</td>
                            </tr>
                        );
                    })}
                    {filteredEvents.length === 0 && (
                        <tr><td colSpan={21} className="px-4 py-8 text-center text-gray-500 italic">No events found for this period.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default LogbookView;
