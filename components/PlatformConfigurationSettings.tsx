import React, { useEffect, useMemo, useState } from 'react';

type PlatformConfig = {
  organisations: any[];
  locations: any[];
  units: any[];
  aircraftTypes: any[];
  resourcePools: any[];
  modules: any[];
  unitModules: any[];
  schedulingRuleSets: any[];
};

const emptyConfig: PlatformConfig = {
  organisations: [],
  locations: [],
  units: [],
  aircraftTypes: [],
  resourcePools: [],
  modules: [],
  unitModules: [],
  schedulingRuleSets: [],
};

const getApiBase = (): string => {
  const railwayBackend = 'https://dfp-neo-v2-production.up.railway.app';
  const currentOrigin = window.location.origin;
  if (currentOrigin === railwayBackend || currentOrigin.includes('railway.app')) return '/api';
  return `${railwayBackend}/api`;
};

const fieldClass = 'w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400';

interface PlatformConfigurationSettingsProps {
  currentUserPermission: 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';
  onShowSuccess: (message: string) => void;
}

const PlatformConfigurationSettings: React.FC<PlatformConfigurationSettingsProps> = ({
  currentUserPermission,
  onShowSuccess,
}) => {
  const [config, setConfig] = useState<PlatformConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEdit = ['Super Admin', 'Admin'].includes(currentUserPermission);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${getApiBase()}/platform-config`);
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = await res.json();
        if (!cancelled) setConfig({ ...emptyConfig, ...data });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load platform configuration');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const enabledModuleCount = useMemo(
    () => config.unitModules.filter((item) => item.isEnabled !== false).length,
    [config.unitModules],
  );

  const updateRow = (collection: keyof PlatformConfig, index: number, changes: Record<string, any>) => {
    setConfig((prev) => ({
      ...prev,
      [collection]: prev[collection].map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...changes } : item
      )),
    }));
  };

  const addUnit = () => {
    const defaultLocation = config.locations[0]?.code || 'ESL';
    setConfig((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          code: `UNIT-${prev.units.length + 1}`,
          name: 'New Unit',
          organisationCode: prev.organisations[0]?.code || 'DEFAULT',
          locationCode: defaultLocation,
          unitType: 'Training',
          status: 'ACTIVE',
          settings: {},
        },
      ],
    }));
  };

  const addResourcePool = () => {
    const defaultLocation = config.locations[0]?.code || 'ESL';
    setConfig((prev) => ({
      ...prev,
      resourcePools: [
        ...prev.resourcePools,
        {
          code: `POOL-${prev.resourcePools.length + 1}`,
          name: 'New Resource Pool',
          organisationCode: prev.organisations[0]?.code || 'DEFAULT',
          locationCode: defaultLocation,
          unitCode: '',
          aircraftTypeCode: prev.aircraftTypes[0]?.code || 'PC-21',
          poolType: 'Dedicated',
          status: 'ACTIVE',
          settings: {
            applyToV2Runtime: false,
            aircraft: 24,
            ftd: 5,
            cpt: 4,
            standby: 4,
            ground: 6,
          },
        },
      ],
    }));
  };

  const updateResourcePoolSettings = (index: number, changes: Record<string, any>) => {
    const currentSettings = config.resourcePools[index]?.settings || {};
    updateRow('resourcePools', index, {
      settings: {
        ...currentSettings,
        ...changes,
      },
    });
  };

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/platform-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Save failed (${res.status})`);
      }
      onShowSuccess('Platform configuration saved');
    } catch (err: any) {
      setError(err?.message || 'Failed to save platform configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-gray-300">
        Loading platform configuration...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-cyan-100">Platform Configuration</h3>
            <p className="mt-1 text-sm text-cyan-100/70">
              Commercial operating model. Resource pools can now be wired into V2 runtime by exception, while existing V2 behaviour remains the default.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!canEdit || saving}
            className="ml-auto rounded border border-gray-500 bg-gray-300 px-5 py-3 text-sm font-bold text-gray-900 shadow hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {!canEdit && (
          <div className="mt-3 rounded border border-yellow-600/50 bg-yellow-900/30 px-3 py-2 text-sm text-yellow-100">
            Read-only. Super Admin or Admin permission is required to change platform configuration.
          </div>
        )}
        {error && (
          <div className="mt-3 rounded border border-red-600/50 bg-red-900/30 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Organisations" value={config.organisations.length} />
        <Metric label="Locations" value={config.locations.length} />
        <Metric label="Units" value={config.units.length} />
        <Metric label="Enabled Modules" value={enabledModuleCount} />
      </div>

      <section className="rounded-lg border border-gray-700 bg-gray-800">
        <SectionHeader title="Organisation & Locations" subtitle="The top of the hierarchy: customer, base, timezone, and training areas." />
        <div className="space-y-4 p-4">
          {config.organisations.map((org, index) => (
            <div key={org.id || org.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-3">
              <Field label="Organisation Code" value={org.code} disabled={!canEdit} onChange={(value) => updateRow('organisations', index, { code: value })} />
              <Field label="Organisation Name" value={org.name} disabled={!canEdit} onChange={(value) => updateRow('organisations', index, { name: value })} />
              <SelectField label="Status" value={org.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('organisations', index, { status: value })} />
            </div>
          ))}
          {config.locations.map((location, index) => (
            <div key={location.id || location.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-5">
              <Field label="Location Code" value={location.code} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { code: value })} />
              <Field label="Location Name" value={location.name} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { name: value })} />
              <NumberField label="UTC Offset" value={location.timezoneOffset ?? 10} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { timezoneOffset: value })} />
              <Field label="Training Areas" value={(location.trainingAreas || []).join(', ')} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { trainingAreas: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
              <SelectField label="Status" value={location.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('locations', index, { status: value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-800">
        <SectionHeader
          title="Units"
          subtitle="Unit is the centre of configuration: type, location, enabled modules and future UI behaviour."
          action={canEdit ? <button type="button" onClick={addUnit} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Unit</button> : null}
        />
        <div className="space-y-3 p-4">
          {config.units.map((unit, index) => (
            <div key={unit.id || unit.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-5">
              <Field label="Unit Code" value={unit.code} disabled={!canEdit} onChange={(value) => updateRow('units', index, { code: value })} />
              <Field label="Unit Name" value={unit.name} disabled={!canEdit} onChange={(value) => updateRow('units', index, { name: value })} />
              <SelectField label="Location" value={unit.locationCode || ''} disabled={!canEdit} options={config.locations.map((location) => location.code)} onChange={(value) => updateRow('units', index, { locationCode: value })} />
              <SelectField label="Unit Type" value={unit.unitType || 'Training'} disabled={!canEdit} options={['Training', 'Fighter', 'Airlift', 'Maritime', 'HQ', 'Operational']} onChange={(value) => updateRow('units', index, { unitType: value })} />
              <SelectField label="Status" value={unit.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('units', index, { status: value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-800">
        <SectionHeader title="Aircraft Types & Resource Pools" subtitle="Aircraft type defines capability; resource pools define shared or dedicated aircraft, FTD, CPT and ground resources." action={canEdit ? <button type="button" onClick={addResourcePool} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Pool</button> : null} />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            {config.aircraftTypes.map((aircraft, index) => (
              <div key={aircraft.id || aircraft.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-3">
                <Field label="Code" value={aircraft.code} disabled={!canEdit} onChange={(value) => updateRow('aircraftTypes', index, { code: value })} />
                <Field label="Name" value={aircraft.name} disabled={!canEdit} onChange={(value) => updateRow('aircraftTypes', index, { name: value })} />
                <SelectField label="Category" value={aircraft.category || 'Training'} disabled={!canEdit} options={['Training', 'Fighter', 'Airlift', 'Maritime', 'Rotary', 'Other']} onChange={(value) => updateRow('aircraftTypes', index, { category: value })} />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {config.resourcePools.map((pool, index) => (
              <div key={pool.id || pool.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-2">
                <Field label="Pool Code" value={pool.code} disabled={!canEdit} onChange={(value) => updateRow('resourcePools', index, { code: value })} />
                <Field label="Pool Name" value={pool.name} disabled={!canEdit} onChange={(value) => updateRow('resourcePools', index, { name: value })} />
                <SelectField label="Location" value={pool.locationCode || ''} disabled={!canEdit} options={['', ...config.locations.map((location) => location.code)]} onChange={(value) => updateRow('resourcePools', index, { locationCode: value || null })} />
                <SelectField label="Owning Unit" value={pool.unitCode || ''} disabled={!canEdit} options={['', ...config.units.map((unit) => unit.code)]} onChange={(value) => updateRow('resourcePools', index, { unitCode: value || null })} />
                <SelectField label="Aircraft Type" value={pool.aircraftTypeCode || ''} disabled={!canEdit} options={['', ...config.aircraftTypes.map((aircraft) => aircraft.code)]} onChange={(value) => updateRow('resourcePools', index, { aircraftTypeCode: value || null })} />
                <SelectField label="Pool Type" value={pool.poolType || 'Dedicated'} disabled={!canEdit} options={['Dedicated', 'Shared']} onChange={(value) => updateRow('resourcePools', index, { poolType: value })} />
                <ToggleField
                  label="Apply to V2 runtime"
                  checked={pool.settings?.applyToV2Runtime === true}
                  disabled={!canEdit}
                  onChange={(checked) => updateResourcePoolSettings(index, { applyToV2Runtime: checked })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Aircraft" value={pool.settings?.aircraft ?? 24} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { aircraft: value })} />
                  <NumberField label="FTD" value={pool.settings?.ftd ?? 5} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { ftd: value })} />
                  <NumberField label="CPT" value={pool.settings?.cpt ?? 4} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { cpt: value })} />
                  <NumberField label="STBY" value={pool.settings?.standby ?? 4} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { standby: value })} />
                  <NumberField label="Ground" value={pool.settings?.ground ?? 6} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { ground: value })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-800">
        <SectionHeader title="Unit Modules" subtitle="Controls which functional modules each unit can use. This is the future licensing and role-aware UI switchboard." />
        <div className="overflow-x-auto p-4">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-950 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2">Unit</th>
                {config.modules.map((module) => <th key={module.code} className="px-3 py-2">{module.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {config.units.map((unit) => (
                <tr key={unit.code} className="border-t border-gray-700">
                  <td className="px-3 py-2 font-semibold text-white">{unit.name}</td>
                  {config.modules.map((module) => {
                    const unitModuleIndex = config.unitModules.findIndex((item) => item.unitCode === unit.code && item.moduleCode === module.code);
                    const unitModule = config.unitModules[unitModuleIndex];
                    return (
                      <td key={module.code} className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={unitModule?.isEnabled !== false}
                          disabled={!canEdit}
                          onChange={(event) => {
                            if (unitModuleIndex >= 0) {
                              updateRow('unitModules', unitModuleIndex, { isEnabled: event.target.checked });
                              return;
                            }
                            setConfig((prev) => ({
                              ...prev,
                              unitModules: [...prev.unitModules, { unitCode: unit.code, moduleCode: module.code, isEnabled: event.target.checked, settings: {} }],
                            }));
                          }}
                          className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-800">
        <SectionHeader title="Scheduling Rule Sets" subtitle="Stage-one records current scheduling assumptions as named, editable rule sets for units and aircraft types." />
        <div className="space-y-3 p-4">
          {config.schedulingRuleSets.map((ruleSet, index) => (
            <div key={ruleSet.id || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-5">
              <Field label="Name" value={ruleSet.name} disabled={!canEdit} onChange={(value) => updateRow('schedulingRuleSets', index, { name: value })} />
              <SelectField label="Unit" value={ruleSet.unitCode || ''} disabled={!canEdit} options={['', ...config.units.map((unit) => unit.code)]} onChange={(value) => updateRow('schedulingRuleSets', index, { unitCode: value || null })} />
              <SelectField label="Aircraft Type" value={ruleSet.aircraftTypeCode || ''} disabled={!canEdit} options={['', ...config.aircraftTypes.map((aircraft) => aircraft.code)]} onChange={(value) => updateRow('schedulingRuleSets', index, { aircraftTypeCode: value || null })} />
              <SelectField label="Scope" value={ruleSet.scope || 'Unit'} disabled={!canEdit} options={['Organisation', 'Location', 'Unit', 'AircraftType']} onChange={(value) => updateRow('schedulingRuleSets', index, { scope: value })} />
              <SelectField label="Active" value={ruleSet.isActive === false ? 'No' : 'Yes'} disabled={!canEdit} options={['Yes', 'No']} onChange={(value) => updateRow('schedulingRuleSets', index, { isActive: value === 'Yes' })} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-2 text-2xl font-bold text-white">{value}</div>
  </div>
);

const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3 border-b border-gray-700 px-4 py-3">
    <div>
      <h4 className="text-base font-bold text-white">{title}</h4>
      <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
    </div>
    {action && <div className="ml-auto">{action}</div>}
  </div>
);

const Field = ({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input className={fieldClass} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const NumberField = ({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input className={fieldClass} type="number" value={value ?? 0} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const ToggleField = ({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center justify-between gap-3 rounded border border-gray-700 bg-gray-950 px-3 py-2">
    <span className="text-sm font-semibold text-gray-200">{label}</span>
    <input
      type="checkbox"
      className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  </label>
);

const SelectField = ({ label, value, disabled, options, onChange }: { label: string; value: string; disabled: boolean; options: string[]; onChange: (value: string) => void }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <select className={fieldClass} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option || 'None'}</option>)}
    </select>
  </label>
);

export default PlatformConfigurationSettings;
