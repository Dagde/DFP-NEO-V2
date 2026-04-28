// Seed some test audit logs for demonstration

import { logAudit } from './auditLogger';

export const seedTestAuditLogs = () => {
  // Program Schedule logs
  logAudit(
    'Program Schedule',
    'Add',
    'Added new flight event BGF5 for PLTOFF Smith',
    'Event: BGF5, Time: 0800, Duration: 1.2hrs, Instructor: SQNLDR Jones'
  );
  
  logAudit(
    'Program Schedule',
    'Edit',
    'Modified flight event BGF3 start time',
    'Changed start time from 0900 to 1000'
  );
  
  logAudit(
    'Program Schedule',
    'Delete',
    'Removed ground event for Course 301',
    'Event: Ground School, Time: 1400'
  );

  // Next Day Build logs
  logAudit(
    'Next Day Build',
    'View',
    'Viewed Next Day Build schedule for 2024-12-30',
    null
  );
  
  logAudit(
    'Next Day Build',
    'Add',
    'Added SCT event for FLTLT Brown',
    'Event: SCT GF, Time: 0730, Type: Solo'
  );

  // Priorities logs
  logAudit(
    'Priorities',
    'Edit',
    'Updated course priority order',
    'Moved Course 302 above Course 301'
  );
  
  logAudit(
    'Priorities',
    'Edit',
    'Changed flying window times',
    'Start: 0700 → 0730, End: 1700 → 1730'
  );

  console.log('✅ Test audit logs seeded successfully');
};