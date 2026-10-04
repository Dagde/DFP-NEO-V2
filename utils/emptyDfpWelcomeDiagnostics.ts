export const EMPTY_DFP_WELCOME_DIAGNOSTIC_STORAGE_KEY = 'empty_dfp_welcome_diagnostic_report';
export const EMPTY_DFP_WELCOME_DIAGNOSTIC_EVENT = 'emptyDfpWelcomeDiagnostic';
const EMPTY_DFP_WELCOME_DIAGNOSTIC_VERSION = 1;

export type EmptyDfpWelcomeDiagnosticEntry = {
  stage: string;
  at: string;
  details?: Record<string, any>;
};

export const recordEmptyDfpWelcomeDiagnostic = (
  entry: Omit<EmptyDfpWelcomeDiagnosticEntry, 'at'>,
): void => {
  if (typeof window === 'undefined') return;

  const fullEntry: EmptyDfpWelcomeDiagnosticEntry = {
    ...entry,
    at: new Date().toISOString(),
  };

  try {
    const win = window as any;
    const entries: EmptyDfpWelcomeDiagnosticEntry[] = Array.isArray(win.__emptyDfpWelcomeDiagnostics)
      ? win.__emptyDfpWelcomeDiagnostics
      : [];
    entries.push(fullEntry);
    const trimmed = entries.slice(-300);
    win.__emptyDfpWelcomeDiagnostics = trimmed;
    win.__lastEmptyDfpWelcomeDiagnostic = fullEntry;

    const report = {
      generatedAt: new Date().toISOString(),
      app: 'DFP-NEO',
      reportType: 'empty-dfp-welcome-diagnostic',
      version: EMPTY_DFP_WELCOME_DIAGNOSTIC_VERSION,
      userAgent: window.navigator?.userAgent || '',
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      entries: trimmed,
    };

    window.localStorage?.setItem(EMPTY_DFP_WELCOME_DIAGNOSTIC_STORAGE_KEY, JSON.stringify(report));
    window.dispatchEvent(new CustomEvent(EMPTY_DFP_WELCOME_DIAGNOSTIC_EVENT, { detail: fullEntry }));

    const shouldLog = (entry.stage === 'app-decision' && entry.details?.activeView === 'Program Schedule')
      || entry.stage === 'schedule-render-missing'
      || entry.details?.showEmptyDfpWelcome === true
      || entry.details?.overlayShouldRender === true;
    if (shouldLog) {
      console.info('[Empty DFP Welcome Diagnostic]', fullEntry);
    }
  } catch (error) {
    console.warn('[Empty DFP Welcome Diagnostic] Failed to record entry:', error);
  }
};
