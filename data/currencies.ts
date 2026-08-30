import { CurrencyRequirement, MasterCurrency, PostFlightInputType } from '../types';

export const DEFAULT_1FTS_CURRENCY_REQUIREMENTS: CurrencyRequirement[] = [
  { id: 'aircrew-medical', name: 'Aircrew Medical', description: 'Annual aircrew medical check.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'combat-survival', name: 'Combat Survival Refresher', description: 'Annual combat survival training.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'live-fire', name: 'W/PN Live Fire Licence', description: 'Annual live fire qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'category-check', name: 'Category Check', description: 'Annual instructor category check.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'wpn-handling', name: 'WPN Handing Test', description: 'Annual weapon handling test.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'pft', name: 'Physical Fitness Test', description: 'Annual physical fitness test.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'arm', name: 'Aviation Risk Management', description: 'Annual ARM course.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'nts', name: 'Non-Technical Skills', description: 'Annual NTS training.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'alse-survival', name: 'ALSE/Survival Theory', description: 'Annual ALSE and survival theory.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'dinghy-drill', name: 'Dinghy Drill', description: 'Annual dinghy drill.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'pc21-life-support', name: 'PC21 Life Support AF/BF Qualification', description: 'Annual PC21 life support qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'pc21-training', name: 'PC21 AF/BF/TA Training', description: 'Annual PC21 training.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'avmed-refresher', name: 'AVMED Refresher', description: 'Annual AVMED refresher.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'duty-instructor', name: 'Duty Instructor', description: 'Annual duty instructor qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'fob', name: 'Flying Order Book', description: 'Annual FOB check.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'night-glide-solo', name: 'Night Glide Solo', description: 'Annual night glide solo qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: '4-ship-wing', name: '4 Ship Wing', description: 'Annual 4-ship wing qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: '4-ship-lead', name: '4 Ship Lead', description: 'Annual 4-ship lead qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'tac-form-wing', name: 'Tac Form wing', description: 'Annual tactical formation wing qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'tac-form-lead', name: 'Tac Form Lead', description: 'Annual tactical formation lead qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'if-currency-ride', name: 'IF Currency Ride', description: 'Annual instrument flight currency ride.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'low-flying', name: 'Low Flying', description: 'Annual low flying qualification.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'navigation', name: 'Navigation', description: 'Annual navigation check.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'dental', name: 'Dental', description: 'Annual dental check.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'pc21-emergency-check', name: 'PC21 Emergency Check', description: 'Annual PC21 emergency check.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'pc21-instrument-rating', name: 'PC21 Instrument Rating Test', description: 'Annual PC21 instrument rating test.', type: 'primitive', isVisible: true, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'pc21-day-gf-30d', name: 'PC21 Day General Flying 30D', description: 'At least one general flying event in last 30 days.', type: 'primitive', isVisible: true, validityDays: 30, eventCodes: [], requiredCount: 1, expiryRule: 'ROLLING_WINDOW', showInPostFlight: false, showInPostFlightRecency: true, postFlightInputTypes: ['count'] },
  { id: 'pc21-3-ia-90d', name: 'PC21 3 Instrument Approach in 90 Days', description: 'Three instrument approaches in last 90 days.', type: 'primitive', isVisible: true, validityDays: 90, eventCodes: [], requiredCount: 3, expiryRule: 'ROLLING_WINDOW', showInPostFlight: false, showInPostFlightRecency: true, postFlightInputTypes: ['count'] },
  { id: 'ia-3d-90d', name: 'IA 3D PC21 90D', description: '3D instrument approach in last 90 days.', type: 'primitive', isVisible: true, validityDays: 90, eventCodes: [], requiredCount: 1, expiryRule: 'ROLLING_WINDOW', showInPostFlight: false, showInPostFlightRecency: true, postFlightInputTypes: ['count'] },
  { id: 'ia-2d-90d', name: 'IA 2D PC21 90D', description: '2D instrument approach in last 90 days.', type: 'primitive', isVisible: true, validityDays: 90, eventCodes: [], requiredCount: 1, expiryRule: 'ROLLING_WINDOW', showInPostFlight: false, showInPostFlightRecency: true, postFlightInputTypes: ['count'] },
  { id: 'pc21-night-90d', name: 'PC21 Night Flying 90D', description: 'Night flying event in last 90 days.', type: 'primitive', isVisible: true, validityDays: 90, eventCodes: [], requiredCount: 1, expiryRule: 'ROLLING_WINDOW', showInPostFlight: false, showInPostFlightRecency: true, postFlightInputTypes: ['count'] },
  { id: 'wpn-9mm', name: '9mm Qualification', description: 'Qualification on 9mm pistol.', type: 'primitive', isVisible: false, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'wpn-glock', name: 'Glock Qualification', description: 'Qualification on Glock pistol.', type: 'primitive', isVisible: false, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
  { id: 'wpn-rifle', name: 'Rifle Qualification', description: 'Qualification on service rifle.', type: 'primitive', isVisible: false, validityDays: 365, eventCodes: [], requiredCount: 1, expiryRule: 'LAST_EVENT_PLUS_PERIOD', showInPostFlight: false, postFlightInputTypes: ['date'] },
];

export const DEFAULT_1FTS_MASTER_CURRENCIES: MasterCurrency[] = [
    {
        id: 'day-go',
        name: 'DAY GO',
        description: 'Determines if a pilot is authorized for day flying operations.',
        type: 'composite',
        isVisible: true,
        expiryCalculation: 'EARLIEST_CHILD',
        showInPostFlight: false,
        postFlightInputTypes: ['checkbox'],
        logicTree: {
            operator: 'AND',
            children: [
                'aircrew-medical',
                'pft',
                {
                    operator: 'OR',
                    children: [
                        'pc21-day-gf-30d',
                        'if-currency-ride'
                    ]
                }
            ]
        }
    },
    {
        id: 'if-go-no-go',
        name: 'IF GO/NO GO',
        description: 'Determines if a pilot is authorized for instrument flying operations.',
        type: 'composite',
        isVisible: true,
        expiryCalculation: 'EARLIEST_CHILD',
        showInPostFlight: false,
        postFlightInputTypes: ['checkbox'],
        logicTree: {
            operator: 'AND',
            children: [
                'day-go',
                'pc21-instrument-rating',
                'pc21-3-ia-90d'
            ]
        }
    },
    {
        id: 'weapons-currency',
        name: 'Weapons Currency',
        description: 'Overall weapons qualification status.',
        type: 'composite',
        isVisible: true,
        expiryCalculation: 'LATEST_CHILD',
        showInPostFlight: false,
        postFlightInputTypes: ['checkbox'],
        logicTree: {
            operator: 'OR',
            children: [
                'wpn-9mm',
                'wpn-glock',
                'wpn-rifle'
            ]
        }
    }
];

export const buildDefault1FtsCurrencyDefinitions = (): {
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
} => ({
    masterCurrencies: DEFAULT_1FTS_MASTER_CURRENCIES.map(currency => ({ ...currency, logicTree: JSON.parse(JSON.stringify(currency.logicTree)) })),
    currencyRequirements: DEFAULT_1FTS_CURRENCY_REQUIREMENTS.map(currency => ({ ...currency, eventCodes: [...currency.eventCodes], postFlightInputTypes: [...(currency.postFlightInputTypes || [])] })),
});

/**
 * Normalises saved currency records without restoring deleted starter values.
 * Existing records keep their user-edited values, while older records receive
 * compatibility fields added after the original currency schema.
 */
export const mergeWithInitialCurrencies = (
    dbRequirements: CurrencyRequirement[],
    dbMasters: MasterCurrency[]
): { requirements: CurrencyRequirement[]; masters: MasterCurrency[] } => {
    // Back-fill new fields on existing DB records that predate this schema.
    // Also migrates old single-value postFlightInputType → postFlightInputTypes array.
    const enrichedReqs = dbRequirements.map(dbCur => {
        const legacy = dbCur as any;
        // Migrate legacy single-value field to array
        const migratedTypes: PostFlightInputType[] | undefined =
            dbCur.postFlightInputTypes ??
            (legacy.postFlightInputType ? [legacy.postFlightInputType as PostFlightInputType] : undefined);
        // Explicitly preserve showInPostFlight from DB - coerce to boolean to handle JSONB serialisation edge cases
        const showInPostFlight = dbCur.showInPostFlight !== undefined && dbCur.showInPostFlight !== null
            ? Boolean(dbCur.showInPostFlight)
            : false;
        const showInPostFlightRecency = dbCur.showInPostFlightRecency !== undefined && dbCur.showInPostFlightRecency !== null
            ? Boolean(dbCur.showInPostFlightRecency)
            : false;
        return {
            postFlightInputTypes: dbCur.expiryRule === 'ROLLING_WINDOW' ? ['count'] : ['date'],
            ...dbCur,
            showInPostFlight,
            showInPostFlightRecency,
            ...(migratedTypes ? { postFlightInputTypes: migratedTypes } : {}),
        } as CurrencyRequirement;
    });

    const enrichedMasters = dbMasters.map(dbCur => {
        const legacy = dbCur as any;
        const migratedTypes: PostFlightInputType[] | undefined =
            dbCur.postFlightInputTypes ??
            (legacy.postFlightInputType ? [legacy.postFlightInputType as PostFlightInputType] : undefined);
        // Explicitly preserve showInPostFlight from DB - coerce to boolean
        const showInPostFlight = dbCur.showInPostFlight !== undefined && dbCur.showInPostFlight !== null
            ? Boolean(dbCur.showInPostFlight)
            : false;
        const showInPostFlightRecency = dbCur.showInPostFlightRecency !== undefined && dbCur.showInPostFlightRecency !== null
            ? Boolean(dbCur.showInPostFlightRecency)
            : false;
        return {
            postFlightInputTypes: ['checkbox'] as PostFlightInputType[],
            ...dbCur,
            showInPostFlight,
            showInPostFlightRecency,
            ...(migratedTypes ? { postFlightInputTypes: migratedTypes } : {}),
        } as MasterCurrency;
    });

    return {
        requirements: enrichedReqs,
        masters: enrichedMasters,
    };
};
