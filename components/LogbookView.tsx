import React, { useEffect, useState } from 'react';
import { Instructor, Trainee, ScheduleEvent } from '../types';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';

interface LogbookViewProps {
  person: Instructor | Trainee;
  events: ScheduleEvent[];
  onBack: () => void;
  resourceDisplayNames?: ResourceDisplayNames;
}

interface LogbookRowData {
  year: string;
  date: string;
  type: string;
  tail: string;
  captain: string;
  crew: string;
  duty: string;
  dayP1: string;
  dayP2: string;
  dayDual: string;
  nightP1: string;
  nightP2: string;
  nightDual: string;
  total: string;
  captTime: string;
  instTime: string;
  simIf: string;
  simActual: string;
  app2D: string;
  app3D: string;
  simP1: string;
  simP2: string;
  simDual: string;
  simTotal: string;
  // metadata for display
  _eventDate?: string;
  _role?: string;
  _eventCode?: string;
}

// A single header cell
const HdrCell: React.FC<{ label: string; subLabel?: string; width: string; bgColor?: string }> = ({
  label, subLabel, width, bgColor = 'bg-gray-900/30'
}) => (
  <div className={`flex flex-col items-center justify-end ${width} flex-shrink-0 border-r border-gray-600 last:border-r-0 ${bgColor} py-0.5`}>
    <div className="text-[9px] font-bold text-gray-400 uppercase leading-tight text-center">{label}</div>
    {subLabel && <div className="text-[8px] text-gray-500 leading-tight text-center">{subLabel}</div>}
  </div>
);

// A single data cell
const DataCell: React.FC<{ value: string; width: string; bgColor?: string; borderColor?: string }> = ({
  value, width, bgColor = 'bg-gray-800', borderColor = 'border-gray-600'
}) => (
  <div className={`flex items-center justify-center ${width} flex-shrink-0 border-r ${borderColor} last:border-r-0 ${bgColor} h-7`}>
    <span className="text-white text-xs font-mono truncate px-0.5">{value || ''}</span>
  </div>
);

// Column header row
const HeaderRow: React.FC<{ resourceDisplayNames: ResourceDisplayNames }> = ({ resourceDisplayNames }) => (
  <div className="flex flex-nowrap min-w-max bg-gray-900/60 border-b border-gray-600">
    {/* Row label spacer */}
    <div className="w-24 flex-shrink-0 border-r border-gray-600 bg-gray-900/30" />
    <HdrCell label="Year"    width="w-12" />
    <HdrCell label="Date"    width="w-16" />
    <HdrCell label="Type"    width="w-12" />
    <HdrCell label="Tail"    subLabel="(Mark)" width="w-16" />
    <HdrCell label="Captain" width="w-24" />
    <HdrCell label="Co-Pilot" subLabel="Crew" width="w-24" />
    <HdrCell label="Duty"    width="w-24" />
    {/* Day Flying group */}
    <div className="flex flex-col border-r border-gray-600">
      <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30 px-1">Day Flying</div>
      <div className="flex">
        <HdrCell label="P1"   width="w-10" bgColor="" />
        <HdrCell label="P2"   width="w-10" bgColor="" />
        <HdrCell label="Dual" width="w-10" bgColor="" />
      </div>
    </div>
    {/* Night Flying group */}
    <div className="flex flex-col border-r border-gray-600">
      <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30 px-1">Night Flying</div>
      <div className="flex">
        <HdrCell label="P1"   width="w-10" bgColor="" />
        <HdrCell label="P2"   width="w-10" bgColor="" />
        <HdrCell label="Dual" width="w-10" bgColor="" />
      </div>
    </div>
    <HdrCell label="TOTAL"      width="w-12" bgColor="bg-gray-700/40" />
    <HdrCell label="Captain"    width="w-12" />
    <HdrCell label="Instructor" width="w-12" />
    <HdrCell label="Sim IF"     width="w-10" />
    <HdrCell label="Actual IF"  width="w-10" />
    <HdrCell label="2D App"     width="w-10" />
    <HdrCell label="3D App"     width="w-10" />
    {/* Simulator group */}
    <div className="flex flex-col">
      <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30 px-1">{resourceDisplayNames.ftd}</div>
      <div className="flex">
        <HdrCell label="P1"    width="w-10" bgColor="bg-gray-800/30" />
        <HdrCell label="P2"    width="w-10" bgColor="bg-gray-800/30" />
        <HdrCell label="Dual"  width="w-10" bgColor="bg-gray-800/30" />
        <HdrCell label="TOTAL" width="w-10" bgColor="bg-gray-800/30" />
      </div>
    </div>
  </div>
);

// A single data row
const DataRow: React.FC<{ row: LogbookRowData; isEven: boolean }> = ({ row, isEven }) => {
  const rowBg = isEven ? 'bg-gray-800/40' : 'bg-gray-800/20';
  return (
    <div className={`flex flex-nowrap min-w-max border-t border-gray-700/50 ${rowBg} hover:bg-gray-700/30 transition-colors`}>
      {/* Row label: role + event code */}
      <div className="flex flex-col items-start justify-center w-24 flex-shrink-0 border-r border-gray-600 px-2">
        <span className="text-[8px] font-bold text-sky-400 leading-tight truncate w-full">{row._role || ''}</span>
        <span className="text-[8px] text-gray-500 leading-tight truncate w-full">{row._eventCode || ''}</span>
      </div>
      <DataCell value={row.year}    width="w-12" />
      <DataCell value={row.date}    width="w-16" />
      <DataCell value={row.type}    width="w-12" />
      <DataCell value={row.tail}    width="w-16" />
      <DataCell value={row.captain} width="w-24" />
      <DataCell value={row.crew}    width="w-24" />
      <DataCell value={row.duty}    width="w-24" />
      {/* Day Flying */}
      <div className="flex border-r border-gray-600">
        <DataCell value={row.dayP1}   width="w-10" borderColor="border-gray-700" />
        <DataCell value={row.dayP2}   width="w-10" borderColor="border-gray-700" />
        <DataCell value={row.dayDual} width="w-10" borderColor="border-transparent" />
      </div>
      {/* Night Flying */}
      <div className="flex border-r border-gray-600">
        <DataCell value={row.nightP1}   width="w-10" borderColor="border-gray-700" />
        <DataCell value={row.nightP2}   width="w-10" borderColor="border-gray-700" />
        <DataCell value={row.nightDual} width="w-10" borderColor="border-transparent" />
      </div>
      <DataCell value={row.total}    width="w-12" bgColor="bg-gray-700/40" />
      <DataCell value={row.captTime} width="w-12" />
      <DataCell value={row.instTime} width="w-12" />
      <DataCell value={row.simIf}    width="w-10" />
      <DataCell value={row.simActual} width="w-10" />
      <DataCell value={String(row.app2D || '')} width="w-10" />
      <DataCell value={String(row.app3D || '')} width="w-10" />
      {/* Simulator */}
      <div className="flex">
        <DataCell value={row.simP1}    width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
        <DataCell value={row.simP2}    width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
        <DataCell value={row.simDual}  width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
        <DataCell value={row.simTotal} width="w-10" borderColor="border-transparent" bgColor="bg-gray-800/50" />
      </div>
    </div>
  );
};

const LogbookView: React.FC<LogbookViewProps> = ({ person, events, onBack, resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES }) => {
  const [rows, setRows] = useState<LogbookRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const personName = person.name;

  useEffect(() => {
    setLoading(true);
    setError(null);

    const lastName = personName.split(',')[0]?.trim() || personName;

    fetch(`/api/flight-log?personName=${encodeURIComponent(lastName)}`, {
      credentials: 'include',
    })
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load'))
      .then((json: any) => {
        const entries: any[] = json.entries || [];

        const logRows: LogbookRowData[] = [];

        for (const entry of entries) {
          // Each entry has captainLogSnapshot and/or crewLogSnapshot
          const snap: any = entry.captainLogSnapshot || entry.crewLogSnapshot;
          if (!snap || typeof snap !== 'object') continue;

          const role = entry.personRole === 'instructor' ? 'Captain' : 'Crew';

          logRows.push({
            year:      snap.year      || (entry.eventDate ? new Date(entry.eventDate).getFullYear().toString() : ''),
            date:      snap.date      || (entry.eventDate ? new Date(entry.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''),
            type:      snap.type      || (entry.isFtdLog ? resourceDisplayNames.ftd : resourceDisplayNames.aircraft),
            tail:      snap.tail      || '',
            captain:   snap.captain   || '',
            crew:      snap.crew      || '',
            duty:      snap.duty      || entry.duty || '',
            dayP1:     snap.dayP1     || '',
            dayP2:     snap.dayP2     || '',
            dayDual:   snap.dayDual   || '',
            nightP1:   snap.nightP1   || '',
            nightP2:   snap.nightP2   || '',
            nightDual: snap.nightDual || '',
            total:     snap.total     || (entry.totalTime != null ? String(entry.totalTime) : ''),
            captTime:  snap.captTime  || '',
            instTime:  snap.instTime  || '',
            simIf:     snap.simIf     || '',
            simActual: snap.simActual || '',
            app2D:     snap.app2D     != null ? String(snap.app2D) : '',
            app3D:     snap.app3D     != null ? String(snap.app3D) : '',
            simP1:     snap.simP1     || '',
            simP2:     snap.simP2     || '',
            simDual:   snap.simDual   || '',
            simTotal:  snap.simTotal  || '',
            _eventDate:  entry.eventDate  || '',
            _role:       role,
            _eventCode:  entry.eventCode  || '',
          });
        }

        // Sort by date ascending
        logRows.sort((a, b) => {
          const da = a._eventDate || '';
          const db = b._eventDate || '';
          return da < db ? -1 : da > db ? 1 : 0;
        });

        setRows(logRows);
        setLoading(false);
      })
      .catch(err => {
        console.error('[LogbookView] Error loading entries:', err);
        setError('Could not load logbook data. Please try again.');
        setLoading(false);
      });
  }, [personName]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-lg font-bold text-white">Logbook — {personName}</h2>
        </div>
        <span className="text-xs text-gray-400">{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-400 text-sm animate-pulse">Loading logbook…</div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-32">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500 text-sm">No logbook entries found for {personName}.</div>
          </div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col bg-gray-900 border border-gray-600 rounded-md min-w-max">
              <HeaderRow resourceDisplayNames={resourceDisplayNames} />
              {rows.map((row, idx) => (
                <DataRow key={`${row._eventDate}-${row._role}-${idx}`} row={row} isEven={idx % 2 === 0} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogbookView;
