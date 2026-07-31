export const SETUP_TEST_QUERY_PARAM = 'setupTest';
export const SETUP_TEST_RESET_QUERY_PARAM = 'resetSetupTest';
export const AIR_MOVEMENTS_TEST_PROFILE = 'air-movements';
export const SETUP_TEST_PLATFORM_EVENT = 'dfp-setup-test-platform-config-updated';
export const SETUP_TEST_PERSONNEL_EVENT = 'dfp-setup-test-personnel-updated';
export const SETUP_TEST_SYLLABUS_EVENT = 'dfp-setup-test-syllabus-updated';
const INITIAL_SETUP_WIZARD_STEP_KEY = 'dfp-initial-setup-wizard-step';
const ACTIVE_OPERATIONAL_CONTEXT_STORAGE_KEY = 'dfp_active_operational_context';

const safeWindow = (): Window | null => (typeof window === 'undefined' ? null : window);

export const resetSetupTestProfile = (profile: string): void => {
  const win = safeWindow();
  if (!win) return;
  const cleanProfile = String(profile || AIR_MOVEMENTS_TEST_PROFILE).trim() || AIR_MOVEMENTS_TEST_PROFILE;
  const setupPrefix = `dfp_setup_test_${cleanProfile}_`;
  Object.keys(win.localStorage)
    .filter((key) => (
      key.startsWith(setupPrefix)
      || key.startsWith('dfp_setup_test_')
      || key.startsWith('dfp_snapshot_cache_')
      || key.startsWith('aircraft-availability-')
      || key.startsWith('dfp_highest_priority_events_v1')
    ))
    .forEach((key) => win.localStorage.removeItem(key));
  [
    INITIAL_SETUP_WIZARD_STEP_KEY,
    'dfp_last_viewed_date',
    'dfp_build_date',
    'systemFreezeState',
    'neoTaskingRequests',
    'neo_remedial_force_schedule_requests',
    'lastBuildAnalysis',
    'neo_build_diag_report',
    'neo_build_runtime_error_report',
    'neo_build_timing_report',
    'neo_tasking_priority_diag',
    'neo_currency_priority_diag',
    'dfp_setup_test_personnel_diag',
    'dfp_setup_test_lmp_diag',
    'dfp_setup_test_context_diag',
    'dfp_setup_wizard_import_diag',
    'neo_dfp_data_diag',
    'neo_lmp_details_active_tab',
    'neo_lmp_details_selected_package',
  ].forEach((key) => win.localStorage.removeItem(key));
  const emptyConfig = createEmptySetupTestPlatformConfig();
  win.localStorage.setItem(`${setupPrefix}platform_config`, JSON.stringify(emptyConfig));
  win.localStorage.setItem(`${setupPrefix}personnel`, JSON.stringify({ instructors: [], trainees: [] }));
  win.localStorage.setItem(`${setupPrefix}syllabus`, JSON.stringify([]));
  win.localStorage.setItem(`${setupPrefix}settings`, JSON.stringify({}));
  win.localStorage.setItem(`${setupPrefix}currencies`, JSON.stringify({ masterCurrencies: [], currencyRequirements: [] }));
  win.localStorage.setItem(ACTIVE_OPERATIONAL_CONTEXT_STORAGE_KEY, JSON.stringify({
    location: '',
    unit: '',
  }));
  win.sessionStorage.removeItem('dfp_setup_test_profile');
  win.dispatchEvent(new CustomEvent(SETUP_TEST_PLATFORM_EVENT, { detail: { config: emptyConfig } }));
  win.dispatchEvent(new CustomEvent(SETUP_TEST_PERSONNEL_EVENT, { detail: { instructors: [], trainees: [] } }));
  win.dispatchEvent(new CustomEvent(SETUP_TEST_SYLLABUS_EVENT, { detail: { syllabus: [] } }));
};

export const getSetupTestProfile = (): string | null => {
  const win = safeWindow();
  if (!win) return null;
  const params = new URLSearchParams(win.location.search);
  const urlProfile = params.get(SETUP_TEST_QUERY_PARAM);
  const cleanUrlProfile = String(urlProfile || '').trim();
  if (cleanUrlProfile) {
    if (params.get(SETUP_TEST_RESET_QUERY_PARAM) === '1') {
      resetSetupTestProfile(cleanUrlProfile);
      params.delete(SETUP_TEST_RESET_QUERY_PARAM);
      const nextSearch = params.toString();
      win.history.replaceState({}, '', `${win.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${win.location.hash}`);
      win.location.reload();
    }
    return cleanUrlProfile;
  }
  win.sessionStorage.removeItem('dfp_setup_test_profile');
  return null;
};

export const isSetupTestMode = (): boolean => Boolean(getSetupTestProfile());

const getSetupTestStorageKey = (kind: string): string => (
  `dfp_setup_test_${getSetupTestProfile() || AIR_MOVEMENTS_TEST_PROFILE}_${kind}`
);

export const createEmptySetupTestPlatformConfig = () => ({
  organisations: [],
  locations: [],
  units: [],
  aircraftTypes: [],
  resourcePools: [],
  modules: [],
  unitModules: [],
  licenses: [],
  userAccess: [],
  platformUsers: [],
  schedulingRuleSets: [],
});

export const readSetupTestPlatformConfig = (): any => {
  const win = safeWindow();
  if (!win) return createEmptySetupTestPlatformConfig();
  try {
    const stored = win.localStorage.getItem(getSetupTestStorageKey('platform_config'));
    if (!stored) return createEmptySetupTestPlatformConfig();
    return {
      ...createEmptySetupTestPlatformConfig(),
      ...JSON.parse(stored),
    };
  } catch {
    return createEmptySetupTestPlatformConfig();
  }
};

export const writeSetupTestPlatformConfig = (config: any): void => {
  const win = safeWindow();
  if (!win) return;
  const nextConfig = {
    ...createEmptySetupTestPlatformConfig(),
    ...(config || {}),
  };
  win.localStorage.setItem(getSetupTestStorageKey('platform_config'), JSON.stringify(nextConfig));
  win.dispatchEvent(new CustomEvent(SETUP_TEST_PLATFORM_EVENT, { detail: { config: nextConfig } }));
};

export const readSetupTestSettings = <T = any>(): T | null => {
  const win = safeWindow();
  if (!win) return null;
  try {
    const stored = win.localStorage.getItem(getSetupTestStorageKey('settings'));
    return stored ? JSON.parse(stored) as T : null;
  } catch {
    return null;
  }
};

export const writeSetupTestSettings = (settings: any): void => {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(getSetupTestStorageKey('settings'), JSON.stringify(settings || {}));
};

export const readSetupTestCurrencies = (): { masterCurrencies: any[]; currencyRequirements: any[] } | null => {
  const win = safeWindow();
  if (!win) return null;
  try {
    const stored = win.localStorage.getItem(getSetupTestStorageKey('currencies'));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      masterCurrencies: Array.isArray(parsed?.masterCurrencies) ? parsed.masterCurrencies : [],
      currencyRequirements: Array.isArray(parsed?.currencyRequirements) ? parsed.currencyRequirements : [],
    };
  } catch {
    return null;
  }
};

export const writeSetupTestCurrencies = (masterCurrencies: any[], currencyRequirements: any[]): void => {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(getSetupTestStorageKey('currencies'), JSON.stringify({
    masterCurrencies: Array.isArray(masterCurrencies) ? masterCurrencies : [],
    currencyRequirements: Array.isArray(currencyRequirements) ? currencyRequirements : [],
  }));
};

export const readSetupTestPersonnel = (): { instructors: any[]; trainees: any[] } => {
  const win = safeWindow();
  if (!win) return { instructors: [], trainees: [] };
  try {
    const stored = win.localStorage.getItem(getSetupTestStorageKey('personnel'));
    if (!stored) return { instructors: [], trainees: [] };
    const parsed = JSON.parse(stored);
    return {
      instructors: Array.isArray(parsed?.instructors) ? parsed.instructors : [],
      trainees: Array.isArray(parsed?.trainees) ? parsed.trainees : [],
    };
  } catch {
    return { instructors: [], trainees: [] };
  }
};

export const writeSetupTestPersonnel = (instructors: any[], trainees: any[]): void => {
  const win = safeWindow();
  if (!win) return;
  const nextPersonnel = {
    instructors: Array.isArray(instructors) ? instructors : [],
    trainees: Array.isArray(trainees) ? trainees : [],
  };
  win.localStorage.setItem(getSetupTestStorageKey('personnel'), JSON.stringify(nextPersonnel));
  win.dispatchEvent(new CustomEvent(SETUP_TEST_PERSONNEL_EVENT, { detail: nextPersonnel }));
};

export const readSetupTestSyllabus = (): any[] => {
  const win = safeWindow();
  if (!win) return [];
  try {
    const stored = win.localStorage.getItem(getSetupTestStorageKey('syllabus'));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeSetupTestSyllabus = (syllabus: any[]): void => {
  const win = safeWindow();
  if (!win) return;
  const nextSyllabus = Array.isArray(syllabus) ? syllabus : [];
  win.localStorage.setItem(getSetupTestStorageKey('syllabus'), JSON.stringify(nextSyllabus));
  win.dispatchEvent(new CustomEvent(SETUP_TEST_SYLLABUS_EVENT, { detail: { syllabus: nextSyllabus } }));
};
