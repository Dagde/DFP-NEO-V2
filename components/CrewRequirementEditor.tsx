import React from 'react';
import type { CrewRequirement, CrewRequirementRole } from '../types';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import {
  formatCrewRequirementSummary,
  getCrewRequirementOptions,
  getCrewRequirementRoleOptions,
  normaliseCrewRequirement,
  resolveCrewRequirement,
} from '../utils/crewRequirements';

interface CrewRequirementEditorProps {
  value?: CrewRequirement | null;
  aircraftCrewComposition?: AircraftCrewComposition;
  crewPositionTerminology?: CrewPositionTerminology;
  operationalModel?: string;
  onChange: (value: CrewRequirement) => void;
  compact?: boolean;
}

const makeRoleId = (): string => `crew-role-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normaliseRoleRows = (
  value?: CrewRequirement | null,
  aircraftCrewComposition?: AircraftCrewComposition,
): CrewRequirementRole[] => {
  const normalised = normaliseCrewRequirement(value);
  if (normalised.mode === 'custom' && normalised.roles && normalised.roles.length > 0) {
    return normalised.roles;
  }
  return resolveCrewRequirement(null, aircraftCrewComposition).roles || [];
};

const CrewRequirementEditor: React.FC<CrewRequirementEditorProps> = ({
  value,
  aircraftCrewComposition,
  crewPositionTerminology,
  operationalModel,
  onChange,
  compact = false,
}) => {
  const normalised = normaliseCrewRequirement(value);
  const effectiveSummary = formatCrewRequirementSummary(value, aircraftCrewComposition, crewPositionTerminology);
  const aircraftDefaultSummary = formatCrewRequirementSummary(null, aircraftCrewComposition, crewPositionTerminology);
  const roleOptions = getCrewRequirementOptions(crewPositionTerminology, operationalModel);
  const customRows = normaliseRoleRows(value, aircraftCrewComposition);
  const getRoleOptionsForRow = (row: CrewRequirementRole) => (
    getCrewRequirementOptions(crewPositionTerminology, operationalModel, getCrewRequirementRoleOptions(row))
  );

  const setMode = (mode: CrewRequirement['mode']) => {
    if (mode === 'aircraft_default') {
      onChange({ mode: 'aircraft_default' });
      return;
    }
    onChange({
      mode: 'custom',
      roles: customRows.length > 0
        ? customRows
        : [{ role: roleOptions[0]?.value || 'Pilot', crewPositionId: roleOptions[0]?.id, count: 1 }],
    });
  };

  const updateRole = (index: number, updates: Partial<CrewRequirementRole>) => {
    const nextRows = customRows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...updates } : row
    ));
    onChange({ mode: 'custom', roles: nextRows });
  };

  const addRole = () => {
    onChange({
      mode: 'custom',
      roles: [
        ...customRows,
        { role: roleOptions[0]?.value || 'Pilot', crewPositionId: roleOptions[0]?.id || makeRoleId(), count: 1 },
      ],
    });
  };

  const removeRole = (index: number) => {
    const nextRows = customRows.filter((_row, rowIndex) => rowIndex !== index);
    onChange({
      mode: 'custom',
      roles: nextRows.length > 0 ? nextRows : [{ role: roleOptions[0]?.value || 'Pilot', crewPositionId: roleOptions[0]?.id, count: 1 }],
    });
  };

  return (
    <div className={`min-w-0 rounded-md border border-slate-600/70 bg-slate-950/50 ${compact ? 'p-2' : 'p-3'} text-xs text-slate-200`}>
      <div className={`${compact ? 'grid grid-cols-[minmax(0,1fr)_minmax(7.5rem,auto)]' : 'flex flex-wrap'} items-center justify-between gap-2`}>
        <div className="min-w-0">
          <div className="font-semibold text-slate-100">Crew Required</div>
          <div className="mt-0.5 break-words text-slate-400">{effectiveSummary}</div>
        </div>
        <select
          value={normalised.mode}
          onChange={(event) => setMode(event.target.value as CrewRequirement['mode'])}
          className={`${compact ? 'w-full max-w-[11rem]' : ''} rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:ring-cyan-500`}
        >
          <option value="aircraft_default">Use aircraft default</option>
          <option value="custom">Custom crew</option>
        </select>
      </div>

      {normalised.mode === 'aircraft_default' ? (
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          Aircraft default: {aircraftDefaultSummary}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {customRows.map((row, index) => (
            <div key={`${row.crewPositionId || row.role}-${index}`} className="grid grid-cols-[1fr_4.5rem_2rem] items-center gap-2">
              <select
                value={row.role}
                onChange={(event) => {
                  const rowRoleOptions = getRoleOptionsForRow(row);
                  const selected = rowRoleOptions.find(option => option.value === event.target.value);
                  updateRole(index, {
                    role: selected?.value || event.target.value,
                    crewPositionId: selected?.id,
                    eligibleRoles: [selected?.value || event.target.value],
                  });
                }}
                className="min-w-0 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:ring-cyan-500"
              >
                {getRoleOptionsForRow(row).map(option => (
                  <option key={option.id} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={20}
                value={row.count}
                onChange={(event) => updateRole(index, { count: Math.max(0, Math.min(20, Math.round(Number(event.target.value) || 0))) })}
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-center text-xs text-white focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => removeRole(index)}
                className="rounded border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                aria-label="Remove crew role"
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRole}
            className="rounded border border-cyan-500/40 px-2 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10"
          >
            + Add role
          </button>
        </div>
      )}
    </div>
  );
};

export default CrewRequirementEditor;
