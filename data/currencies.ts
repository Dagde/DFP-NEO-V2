import { CurrencyRequirement, MasterCurrency, PostFlightInputType } from '../types';

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
