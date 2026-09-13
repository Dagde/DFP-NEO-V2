import {
    getDefaultUnitCallsign,
    normaliseUnitCallsignSettings,
    type UnitCallsignSettings,
} from './unitCallsigns';

const normaliseCallsignPrefixToken = (value: unknown): string => (
    String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
);

export const parseImportedCallsign = (
    rawValue: unknown,
    unitCode: string,
    unitCallsignSettings?: UnitCallsignSettings | null,
): { callsignNumber: number; callsign?: string } | null => {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') return null;

    const raw = String(rawValue).trim().toUpperCase();
    const compact = raw.replace(/[\s-]+/g, '');
    const numberOnly = compact.match(/^\d{1,3}$/);
    const defaultPrefix = getDefaultUnitCallsign(normaliseUnitCallsignSettings(unitCallsignSettings || null), unitCode);
    const normalisedDefaultPrefix = normaliseCallsignPrefixToken(defaultPrefix);

    if (numberOnly) {
        if (!normalisedDefaultPrefix) {
            throw new Error(`Callsign "${raw}" only provides a number, but unit ${unitCode || '(blank)'} has no default callsign prefix configured.`);
        }
        const callsignNumber = Number(numberOnly[0]);
        return {
            callsignNumber,
            callsign: `${normalisedDefaultPrefix}${String(callsignNumber).padStart(3, '0')}`,
        };
    }

    const fullCallsign = compact.match(/^([A-Z][A-Z0-9]*?)(\d{1,3})$/);
    if (!fullCallsign) {
        throw new Error(`Callsign "${raw}" must be a 1-3 digit number or a prefix followed by a 1-3 digit number, such as VIPR003.`);
    }

    const [, prefix, numberText] = fullCallsign;
    if (normalisedDefaultPrefix && prefix !== normalisedDefaultPrefix) {
        throw new Error(`Callsign "${raw}" uses prefix ${prefix}, but unit ${unitCode || '(blank)'} is configured for ${normalisedDefaultPrefix}.`);
    }
    if (!normalisedDefaultPrefix) {
        throw new Error(`Callsign "${raw}" includes prefix ${prefix}, but unit ${unitCode || '(blank)'} has no default callsign prefix configured to validate against.`);
    }

    const callsignNumber = Number(numberText);
    return {
        callsignNumber,
        callsign: `${prefix}${String(callsignNumber).padStart(3, '0')}`,
    };
};
