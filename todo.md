# NEO Build Algorithm Staff List Alignment

## Current State
- Staff Combined Data page shows ALL staff (QFIs, SIM IPs, OFIs, Other Staff)
- NEO Build algorithm only uses QFIs and SIM IPs for scheduling
- Alexander Burns appears in Staff Combined Data but is not scheduled

## Previous Attempt - ROLLED BACK
Tried to update NEO Build algorithm to check both `role === 'QFI'` AND `isQFI === true`, but this broke the Staff List (Alexander Burns disappeared from Staff List again).

## Current Status
- Rolled back to commit 4ad09ac (before the filtering changes)
- Staff List is working correctly again
- NEO Build algorithm still needs to be fixed to use the same data as Staff Combined Data

## Next Steps
[ ] Investigate why the filtering changes broke the Staff List
[ ] Find a different approach to make NEO Build use the same data as Staff Combined Data without breaking the Staff List