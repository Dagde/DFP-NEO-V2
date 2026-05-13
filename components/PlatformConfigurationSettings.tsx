import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PLATFORM_PERMISSION_PROFILES,
  PLATFORM_PERMISSION_CATALOG,
  type PlatformPermissionProfile,
} from '../utils/platformConfigService';

type PlatformConfig = {
  organisations: any[];
  locations: any[];
  units: any[];
  aircraftTypes: any[];
  resourcePools: any[];
  modules: any[];
  unitModules: any[];
  userAccess: any[];
  platformUsers: any[];
  schedulingRuleSets: any[];
};

type PermissionProfile = PlatformPermissionProfile;

const PERMISSION_CATALOG = PLATFORM_PERMISSION_CATALOG;
const DEFAULT_PERMISSION_PROFILES = DEFAULT_PLATFORM_PERMISSION_PROFILES;

const emptyConfig: PlatformConfig = {
  organisations: [],
  locations: [],
  units: [],
  aircraftTypes: [],
  resourcePools: [],
  modules: [],
  unitModules: [],
  userAccess: [],
  platformUsers: [],
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
const sectionClass = 'overflow-hidden rounded-xl border border-sky-500/35 bg-gray-800 shadow-[0_0_0_1px_rgba(125,211,252,0.08),0_18px_45px_rgba(0,0,0,0.28)]';
const sectionHeaderStyle = {
  backgroundColor: 'rgba(30, 64, 89, 0.62)',
  borderColor: 'rgba(125, 211, 252, 0.28)',
};
const sectionAccentStyle = {
  backgroundColor: 'rgba(125, 211, 252, 0.72)',
  boxShadow: '0 0 18px rgba(125, 211, 252, 0.28)',
};
const ACCESS_SCOPE_TONE = {
  border: 'rgba(34, 211, 238, 0.42)',
  fill: 'rgba(8, 145, 178, 0.24)',
  applyBorder: 'rgba(103, 232, 249, 0.62)',
};

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
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [error, setError] = useState('');
  const [selectedAccessUserId, setSelectedAccessUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_PERMISSION_PROFILES[0].id);

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
        if (!cancelled) {
          const nextConfig = { ...emptyConfig, ...data };
          setConfig(nextConfig);
          const firstUserId = nextConfig.platformUsers[0]?.userId || nextConfig.platformUsers[0]?.username || nextConfig.userAccess[0]?.userId || '';
          setSelectedAccessUserId((current) => current || firstUserId);
        }
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

  const permissionProfiles = useMemo<PermissionProfile[]>(() => {
    const profiles = config.organisations[0]?.settings?.permissionProfiles;
    return Array.isArray(profiles) && profiles.length > 0 ? profiles : DEFAULT_PERMISSION_PROFILES;
  }, [config.organisations]);

  const updatePermissionProfiles = (profiles: PermissionProfile[]) => {
    setConfig((prev) => {
      const organisations = prev.organisations.length > 0
        ? prev.organisations
        : [{ code: 'DEFAULT', name: 'Default Organisation', status: 'ACTIVE', settings: {} }];
      return {
        ...prev,
        organisations: organisations.map((org, index) => (
          index === 0
            ? { ...org, settings: { ...(org.settings || {}), permissionProfiles: profiles } }
            : org
        )),
      };
    });
  };

  const updatePermissionProfile = (profileId: string, changes: Partial<PermissionProfile>) => {
    updatePermissionProfiles(permissionProfiles.map((profile) => (
      profile.id === profileId ? { ...profile, ...changes } : profile
    )));
  };

  const selectedPermissionProfile = useMemo(
    () => permissionProfiles.find((profile) => profile.id === selectedProfileId) || permissionProfiles[0],
    [permissionProfiles, selectedProfileId],
  );

  const addPermissionProfile = () => {
    const id = `profile-${Date.now()}`;
    updatePermissionProfiles([
      ...permissionProfiles,
      {
        id,
        name: 'New Permission Profile',
        description: 'Describe what this profile allows.',
        permissions: ['dfp.view'],
      },
    ]);
    setSelectedProfileId(id);
  };

  const displayUserName = (user: any): string => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.displayName || user.username || user.userId || 'Unknown User';
  };

  const userOptions = useMemo(
    () => config.platformUsers
      .map((user) => ({
        id: user.userId || user.username,
        name: displayUserName(user),
        username: user.username || user.userId || '',
        email: user.email || '',
      }))
      .filter((user) => user.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [config.platformUsers],
  );

  const selectedAccessUser = useMemo(
    () => config.platformUsers.find((user) => (user.userId || user.username) === selectedAccessUserId),
    [config.platformUsers, selectedAccessUserId],
  );

  const selectedAccessRows = useMemo(
    () => config.userAccess
      .map((access, index) => ({ access, index }))
      .filter(({ access }) => access.userId === selectedAccessUserId),
    [config.userAccess, selectedAccessUserId],
  );

  const selectedUserProfileIds = useMemo(() => {
    const activeRows = selectedAccessRows.filter(({ access }) => String(access.status || '').toUpperCase() !== 'INACTIVE');
    const sourceRows = activeRows.length > 0 ? activeRows : selectedAccessRows;
    const ids = sourceRows.flatMap(({ access }) => (
      Array.isArray(access.settings?.permissionProfileIds) ? access.settings.permissionProfileIds : []
    ));
    return Array.from(new Set(ids));
  }, [selectedAccessRows]);

  const setSelectedUserProfileIds = (profileIds: string[]) => {
    setConfig((prev) => ({
      ...prev,
      userAccess: prev.userAccess.map((access) => (
        access.userId === selectedAccessUserId
          ? { ...access, settings: { ...(access.settings || {}), permissionProfileIds: profileIds } }
          : access
      )),
    }));
  };

  const addUserAccess = () => {
    const defaultUser = selectedAccessUser || config.platformUsers[0];
    const userId = selectedAccessUserId || defaultUser?.userId || defaultUser?.username || '';
    const displayName = defaultUser
      ? `${defaultUser.firstName || ''} ${defaultUser.lastName || ''}`.trim() || defaultUser.username || userId
      : '';

    setConfig((prev) => ({
      ...prev,
      userAccess: [
        ...prev.userAccess,
        {
          userId,
          username: defaultUser?.username || '',
          displayName,
          organisationCode: prev.organisations[0]?.code || 'DEFAULT',
          locationCode: prev.locations[0]?.code || '',
          unitCode: '',
          moduleCode: '',
          role: 'Viewer',
          accessLevel: 'Read',
          status: 'ACTIVE',
          settings: { permissionProfileIds: selectedUserProfileIds },
        },
      ],
    }));
    if (userId) setSelectedAccessUserId(userId);
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
    let shouldReload = false;
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
      shouldReload = true;
      setApplyingChanges(true);
      onShowSuccess('Platform configuration saved. Applying changes...');
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (err: any) {
      setError(err?.message || 'Failed to save platform configuration');
    } finally {
      if (!shouldReload) setSaving(false);
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
    <div className="relative space-y-8">
      {applyingChanges && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/70 backdrop-blur-sm">
          <div className="rounded-xl border border-cyan-400/40 bg-gray-900 px-6 py-5 text-center shadow-2xl">
            <div className="text-lg font-bold text-cyan-100">One moment while we apply your changes</div>
            <p className="mt-2 text-sm text-gray-300">The page will refresh automatically so the updated platform settings are active everywhere.</p>
          </div>
        </div>
      )}
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
            disabled={!canEdit || saving || applyingChanges}
            className="ml-auto rounded border border-gray-500 bg-gray-300 px-5 py-3 text-sm font-bold text-gray-900 shadow hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applyingChanges ? 'Applying...' : saving ? 'Saving...' : 'Save'}
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

      <section className={sectionClass}>
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

      <section className={sectionClass}>
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

      <section className={sectionClass}>
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

      <section className={sectionClass}>
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

      <section className={sectionClass}>
        <SectionHeader
          title="Permission Profiles"
          subtitle="Build reusable role profiles. Profiles define what a user can do; access scopes define where they can do it."
          action={canEdit ? <button type="button" onClick={addPermissionProfile} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Profile</button> : null}
        />
        <div className="grid gap-4 p-4 xl:grid-cols-[340px,1fr]">
          <div className="space-y-2">
            {permissionProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedProfileId(profile.id)}
                className={`w-full rounded border px-4 py-3 text-left ${selectedPermissionProfile?.id === profile.id ? 'border-cyan-400 bg-cyan-500/20' : 'border-gray-700 bg-gray-900 hover:bg-gray-950'}`}
              >
                <div className="text-sm font-bold text-white">{profile.name}</div>
                <div className="mt-1 text-xs text-gray-400">{profile.permissions.length} permissions</div>
              </button>
            ))}
          </div>
          {selectedPermissionProfile && (
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Profile Name" value={selectedPermissionProfile.name} disabled={!canEdit} onChange={(value) => updatePermissionProfile(selectedPermissionProfile.id, { name: value })} />
                <Field label="Description" value={selectedPermissionProfile.description} disabled={!canEdit} onChange={(value) => updatePermissionProfile(selectedPermissionProfile.id, { description: value })} />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {PERMISSION_CATALOG.map((group) => (
                  <div key={group.group} className="rounded border border-gray-700 bg-gray-950 p-3">
                    <h5 className="text-sm font-bold text-cyan-100">{group.group}</h5>
                    <div className="mt-3 space-y-2">
                      {group.items.map(([permissionId, label]) => {
                        const checked = selectedPermissionProfile.permissions.includes(permissionId);
                        return (
                          <label key={permissionId} className="flex items-start gap-2 text-sm text-gray-200">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                              checked={checked}
                              disabled={!canEdit}
                              onChange={(event) => {
                                const permissions = event.target.checked
                                  ? Array.from(new Set([...selectedPermissionProfile.permissions, permissionId]))
                                  : selectedPermissionProfile.permissions.filter((id) => id !== permissionId);
                                updatePermissionProfile(selectedPermissionProfile.id, { permissions });
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={sectionClass}>
        <SectionHeader
          title="User Access Context"
          subtitle="Search by user name, assign permission profiles, then define where those profiles apply."
          action={canEdit ? <button type="button" onClick={addUserAccess} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Scope</button> : null}
        />
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(220px,1fr)_minmax(160px,auto)]">
              <UserSearchSelect
                label="User"
                value={selectedAccessUserId}
                disabled={!canEdit}
                users={userOptions}
                search={userSearch}
                onSearchChange={setUserSearch}
                onChange={(value) => {
                  setSelectedAccessUserId(value);
                  setUserSearch('');
                }}
              />
              <div>
                <span className={labelClass}>Display Name</span>
                <div className="rounded border border-cyan-500/20 bg-gray-950 px-3 py-2 text-sm font-semibold text-cyan-100">
                  {selectedAccessUser
                    ? `${selectedAccessUser.firstName || ''} ${selectedAccessUser.lastName || ''}`.trim() || selectedAccessUser.username || selectedAccessUser.userId
                    : 'No user selected'}
                </div>
              </div>
              <div>
                <span className={labelClass}>Access Scopes</span>
                <div className="rounded border border-cyan-500/20 bg-gray-950 px-3 py-2 text-sm font-semibold text-cyan-100">
                  {selectedAccessRows.length}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-cyan-100/70">
              Profiles define what the user can do. Scope fields define where those profiles apply.
            </p>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-3">
              <h5 className="text-sm font-bold text-white">Assigned Permission Profiles</h5>
              <p className="mt-1 text-xs text-gray-400">Tick each profile this user should receive. The same profiles apply across this user's active access scopes.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {permissionProfiles.map((profile) => {
                const checked = selectedUserProfileIds.includes(profile.id);
                return (
                  <label key={profile.id} className="flex items-start gap-2 rounded border border-gray-700 bg-gray-950 p-3 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                      checked={checked}
                      disabled={!canEdit || selectedAccessRows.length === 0}
                      onChange={(event) => {
                        const profileIds = event.target.checked
                          ? Array.from(new Set([...selectedUserProfileIds, profile.id]))
                          : selectedUserProfileIds.filter((id) => id !== profile.id);
                        setSelectedUserProfileIds(profileIds);
                      }}
                    />
                    <span>
                      <span className="block font-semibold text-white">{profile.name}</span>
                      <span className="mt-1 block text-xs text-gray-400">{profile.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {selectedAccessRows.length === 0 && (
            <div className="rounded border border-yellow-600/40 bg-yellow-900/20 px-3 py-3 text-sm text-yellow-100">
              This user has no access scopes. Add a scope before testing this account.
            </div>
          )}

          {selectedAccessRows.map(({ access, index }) => {
            const appliesToAllFeatures = !access.moduleCode;
            const showAdvancedFeatureArea = access.settings?.showAdvancedFeatureArea === true;
            return (
              <div
                key={access.id || `${access.userId}-${index}`}
                className="rounded border p-3"
                style={{
                  backgroundColor: ACCESS_SCOPE_TONE.fill,
                  borderColor: ACCESS_SCOPE_TONE.border,
                  boxShadow: `0 0 0 1px ${ACCESS_SCOPE_TONE.fill}`,
                }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h5 className="text-sm font-bold text-white">Access Scope</h5>
                  <InfoHint text="This section answers where the selected user's permission profiles apply. Example: Location ESL + Unit 1FTS + all enabled features means the user's selected profiles apply to all 1FTS features at East Sale." />
                  <span className="ml-auto rounded bg-gray-950 px-2 py-1 text-xs font-semibold text-gray-300">
                    {access.locationCode || 'All locations'} / {access.unitCode || 'All units'} / {appliesToAllFeatures ? 'All enabled features' : access.moduleCode}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr_0.75fr_0.85fr]">
                  <SelectField label="Organisation" value={access.organisationCode || 'DEFAULT'} disabled={!canEdit} options={config.organisations.map((org) => org.code)} onChange={(value) => updateRow('userAccess', index, { organisationCode: value })} />
                  <SelectField label="Location" value={access.locationCode || ''} disabled={!canEdit} options={['', ...config.locations.map((location) => location.code)]} onChange={(value) => updateRow('userAccess', index, { locationCode: value || null })} emptyLabel="All Locations" />
                  <SelectField label="Unit" value={access.unitCode || ''} disabled={!canEdit} options={['', ...config.units.map((unit) => unit.code)]} onChange={(value) => updateRow('userAccess', index, { unitCode: value || null })} emptyLabel="All Units" />
                  <SelectField label="Administration Level" value={access.role || 'Viewer'} disabled={!canEdit} options={['Viewer', 'Scheduler', 'Supervisor', 'Unit Admin', 'Platform Admin', 'Super Admin']} onChange={(value) => updateRow('userAccess', index, { role: value })} />
                  <SelectField label="Access" value={access.accessLevel || 'Read'} disabled={!canEdit} options={['Read', 'Write', 'Admin']} onChange={(value) => updateRow('userAccess', index, { accessLevel: value })} />
                  <SelectField label="Status" value={access.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('userAccess', index, { status: value })} />
                </div>

                <div
                  className="mt-3 rounded border p-3"
                  style={{ backgroundColor: ACCESS_SCOPE_TONE.fill, borderColor: ACCESS_SCOPE_TONE.applyBorder }}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <label className="flex items-start gap-2 text-sm text-cyan-50">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                        checked={appliesToAllFeatures}
                        disabled={!canEdit}
                        onChange={(event) => updateRow('userAccess', index, { moduleCode: event.target.checked ? null : (config.modules[0]?.code || '') })}
                      />
                      <span>
                        <span className="block font-bold">Apply to all enabled features for this unit</span>
                        <span className="mt-1 block text-xs text-cyan-100/70">
                          Recommended for normal administration. Platform Admin and Super Admin scopes can open all feature areas for this location/unit.
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => updateRow('userAccess', index, { settings: { ...(access.settings || {}), showAdvancedFeatureArea: !showAdvancedFeatureArea } })}
                      className="ml-auto rounded border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-bold text-gray-100 hover:bg-gray-700"
                    >
                      {showAdvancedFeatureArea ? 'Hide Advanced Feature Area' : 'Advanced Feature Area'}
                    </button>
                  </div>

                  {showAdvancedFeatureArea && (
                    <div className="mt-3 rounded border border-gray-700 bg-gray-950 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <h6 className="text-xs font-bold uppercase tracking-wide text-gray-300">Limit This Scope To One Feature Area</h6>
                        <InfoHint text="Use this only when a user should administer one area but not another. Example: ESL + 1FTS + NEO_BUILD lets the user work with NEO Build for 1FTS, but not training records or reporting." />
                      </div>
                      <SelectField label="Feature Area" value={access.moduleCode || ''} disabled={!canEdit || appliesToAllFeatures} options={['', ...config.modules.map((module) => module.code)]} onChange={(value) => updateRow('userAccess', index, { moduleCode: value || null })} emptyLabel="All Enabled Features" />
                      <p className="mt-2 text-xs text-gray-400">
                        Plain English: leave this as all enabled features unless you deliberately want to restrict this scope to a single app area such as DFP, NEO Build, Training, or Reporting.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={sectionClass}>
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

const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) => {
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b px-4 py-4"
      style={sectionHeaderStyle}
    >
      <div
        className="h-11 w-1.5 rounded-full"
        style={sectionAccentStyle}
      />
      <div>
        <h4 className="text-base font-bold text-white">{title}</h4>
        <p className="mt-1 text-sm text-gray-300">{subtitle}</p>
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
};

const InfoHint = ({ text }: { text: string }) => (
  <span className="group relative inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-500/10 text-xs font-bold text-cyan-100">
    i
    <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-80 -translate-x-1/2 rounded border border-cyan-500/30 bg-gray-950 p-3 text-left text-xs font-normal leading-relaxed text-gray-100 shadow-xl group-hover:block">
      {text}
    </span>
  </span>
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

const SelectField = ({ label, value, disabled, options, onChange, emptyLabel = 'None' }: { label: string; value: string; disabled: boolean; options: string[]; onChange: (value: string) => void; emptyLabel?: string }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <select className={fieldClass} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option || emptyLabel}</option>)}
    </select>
  </label>
);

const UserSearchSelect = ({
  label,
  value,
  disabled,
  users,
  search,
  onSearchChange,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  users: Array<{ id: string; name: string; username: string; email: string }>;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const query = search.trim().toLowerCase();
  const filteredUsers = users
    .filter((user) => {
      if (!query) return true;
      return [user.name, user.username, user.email].some((field) => field.toLowerCase().includes(query));
    })
    .slice(0, 30);

  return (
    <label className="relative block">
      <span className={labelClass}>{label}</span>
      <input
        className={fieldClass}
        value={search}
        disabled={disabled}
        placeholder="Search by name..."
        autoComplete="off"
        onChange={(event) => {
          onSearchChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
      />
      {isOpen && !disabled && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded border border-cyan-500/30 bg-gray-950 shadow-xl">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-cyan-500/20 ${
                  user.id === value ? 'bg-cyan-500/15 text-cyan-100' : 'text-gray-100'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(user.id);
                  onSearchChange('');
                  setIsOpen(false);
                }}
              >
                <span className="block font-semibold">{user.name}</span>
                {user.username && <span className="block text-xs text-gray-400">{user.username}</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-yellow-100">
              No users match that name.
            </div>
          )}
        </div>
      )}
    </label>
  );
};

export default PlatformConfigurationSettings;
