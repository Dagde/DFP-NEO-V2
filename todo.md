# Currency DB Migration + PostFlight Integration

## Assessment Findings
1. `data/currencies.ts` holds hardcoded INITIAL_CURRENCY_REQUIREMENTS (30 items) + INITIAL_MASTER_CURRENCIES (3 items)
2. App.tsx seeds from these locals if DB has no currencies — this is the ONLY local dependency
3. Currency definitions ARE saved to DB (AppSettings.data.masterCurrencies / currencyRequirements) already
4. The startup logic: if DB has currencies, use DB; if not, use INITIAL_* hardcoded values
5. **Fix needed**: Seed DB from hardcoded values at startup always (not just when empty), then remove local dep
6. **New field needed**: `showInPostFlight` + `postFlightInputType` on CurrencyRequirement/MasterCurrency
7. **PostFlight**: Show currencies with showInPostFlight=true as a panel RIGHT of the Result box
8. **PostFlight input type analysis**:
   - LAST_EVENT_PLUS_PERIOD (date-based): → date picker (when was it last done?)
   - ROLLING_WINDOW (count-based, e.g., 3 approaches in 90d): → number input
   - Composite: → checkbox (boolean - did you complete this?)

## Tasks
- [x] 1. Add `showInPostFlight` + `postFlightInputType` to TypeScript types
- [x] 2. Update INITIAL_CURRENCY_REQUIREMENTS in data/currencies.ts to include new fields (defaults)
- [x] 3. Update CurrencyBuilderView: add checkbox "Show in Post-Flight" in PrimitiveEditor + CompositeEditor
- [x] 4. Update PostFlightView: add currencies panel to the right of the Result box
- [x] 5. Update App.tsx: ensure currencies always bootstrap from DB, fall back to initial, no local-only state
- [x] 6. settingsService.ts: no changes needed — uses any[] so new fields pass through automatically
- [x] 7. Build and commit to GitHub (commit c10ee94c)
