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

export interface CrewRequirementPreset {
  id: string;
  label: string;
  description?: string;
  kind: 'standard' | 'alternate';
  roles?: CrewRequirementRole[];
}

interface CrewRequirementEditorProps {
  value?: CrewRequirement | null;
  aircraftCrewComposition?: AircraftCrewComposition;
  crewPositionTerminology?: CrewPositionTerminology;
  operationalModel?: string;
  crewRequirementPresets?: CrewRequirementPreset[];
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

const getCrewRolesSignature = (roles?: CrewRequirementRole[]): string => (
  (roles || [])
    .map((role) => {
      const eligibleRoles = Array.isArray(role.eligibleRoles)
        ? role.eligibleRoles.map(value => String(value || '').trim().toUpperCase()).filter(Boolean).sort()
        : [];
      return [
        String(role.role || '').trim().toUpperCase(),
        Math.max(0, Math.min(20, Math.round(Number(role.count) || 0))),
        eligibleRoles.join('|'),
      ].join(':');
    })
    .sort()
    .join(';')
);

const CrewRequirementEditor: React.FC<CrewRequirementEditorProps> = ({
  value,
  aircraftCrewComposition,
  crewPositionTerminology,
  operationalModel,
  crewRequirementPresets = [],
  onChange,
  compact = false,
}) => {
  const normalised = normaliseCrewRequirement(value);
  const effectiveSummary = formatCrewRequirementSummary(value, aircraftCrewComposition, crewPositionTerminology);
  const aircraftDefaultSummary = formatCrewRequirementSummary(null, aircraftCrewComposition, crewPositionTerminology);
  const roleOptions = getCrewRequirementOptions(crewPositionTerminology, operationalModel);
  const customRows = normaliseRoleRows(value, aircraftCrewComposition);
  const normalisedPresetRows = normalised.mode === 'custom' ? normaliseCrewRequirement({ mode: 'custom', roles: customRows }).roles || [] : [];
  const selectedPresetValue = normalised.mode === 'aircraft_default'
    ? crewRequirementPresets.find(preset => preset.kind === 'standard')?.id || 'aircraft_default'
    : crewRequirementPresets.find(preset => (
        preset.kind === 'alternate'
        && getCrewRolesSignature(preset.roles) === getCrewRolesSignature(normalisedPresetRows)
      ))?.id || 'custom';
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

  const setPreset = (presetId: string) => {
    if (presetId === 'custom') {
      setMode('custom');
      return;
    }
    const preset = crewRequirementPresets.find(candidate => candidate.id === presetId);
    if (!preset || preset.kind === 'standard') {
      onChange({ mode: 'aircraft_default' });
      return;
    }
    const presetRows = normaliseCrewRequirement({
      mode: 'custom',
      roles: preset.roles || [],
    }).roles || [];
    onChange({
      mode: 'custom',
      roles: presetRows.length > 0
        ? presetRows
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
    <div className={`min-w-0 rounded-md border border-slate-600/70 bg-slate-950/50 ${compact ? 'flex h-full min-h-[8rem] flex-col p-2' : 'p-3'} text-xs text-slate-200`}>
      <div className={`${compact ? 'grid' : 'flex flex-wrap'} items-center justify-between gap-2`}>
        <div className="min-w-0">
          <div className="font-semibold text-slate-100">Crew Required</div>
          {!compact && <div className="mt-0.5 break-words text-slate-400">{effectiveSummary}</div>}
        </div>
        {crewRequirementPresets.length > 0 ? (
          <select
            value={selectedPresetValue}
            onChange={(event) => setPreset(event.target.value)}
            className={`${compact ? 'w-full max-w-[13rem]' : ''} rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:ring-cyan-500`}
          >
            {crewRequirementPresets.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
            <option value="custom">Custom crew</option>
          </select>
        ) : (
          <select
            value={normalised.mode}
            onChange={(event) => setMode(event.target.value as CrewRequirement['mode'])}
            className={`${compact ? 'w-full max-w-[10.5rem]' : ''} rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:ring-cyan-500`}
          >
            <option value="aircraft_default">Use aircraft default</option>
            <option value="custom">Custom crew</option>
          </select>
        )}
        {compact && <div className="min-w-0 break-words text-slate-400">{effectiveSummary}</div>}
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
