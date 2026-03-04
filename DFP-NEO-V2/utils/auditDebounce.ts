// Audit logging debounce utility
// Waits 3 seconds after the last change before recording to audit log

type AuditLogParams = {
  page: string;
  action: 'Add' | 'Edit' | 'Delete' | 'View' | 'Archive' | 'Restore';
  description: string;
  changes?: string;
};

type AuditLogParamsWithOriginals = {
  page: string;
  action: 'Add' | 'Edit' | 'Delete' | 'View' | 'Archive' | 'Restore';
  description: string;
  changes?: string;
  originalValues?: { startTime?: number; resourceId?: string };
  newValues?: { startTime?: number; resourceId?: string };
};

// Store pending audit logs with timers and track original values
const pendingAudits = new Map<string, { 
  timer: NodeJS.Timeout; 
  originalParams: AuditLogParamsWithOriginals;
  latestParams: AuditLogParamsWithOriginals;
}>();

/**
 * Debounced audit logging - waits 3 seconds after last change before logging
 * @param key - Unique key to identify the change (e.g., "event-123" or "priorities-aircraft-count")
 * @param params - Audit log parameters (can include originalValues and newValues for tile moves)
 * @param logFunction - The actual logAudit function to call after debounce
 */
export const debouncedAuditLog = (
  key: string,
  params: AuditLogParams | AuditLogParamsWithOriginals,
  logFunction: (page: string, action: any, description: string, changes?: string) => void
) => {
  // Clear existing timer if there is one
  const existing = pendingAudits.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    
    // CRITICAL: Keep the ORIGINAL values from first call, update with LATEST values
    const paramsWithOriginals = params as AuditLogParamsWithOriginals;
    const updatedParams: AuditLogParamsWithOriginals = {
      ...paramsWithOriginals,
      originalValues: existing.originalParams.originalValues || paramsWithOriginals.originalValues,
      newValues: paramsWithOriginals.newValues
    };
    
    const timer = setTimeout(() => {
      // Build final changes string using original → latest values
      let finalChanges = params.changes;
      if (updatedParams.originalValues && updatedParams.newValues) {
        const changes = [];
        if (updatedParams.originalValues.startTime !== undefined && updatedParams.newValues.startTime !== undefined) {
          const formatTime = (time: number) => {
            const hours = Math.floor(time);
            const minutes = Math.round((time - hours) * 60);
            return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
          };
          changes.push(`Start time: ${formatTime(updatedParams.originalValues.startTime)} → ${formatTime(updatedParams.newValues.startTime)}`);
        }
        if (updatedParams.originalValues.resourceId !== undefined && updatedParams.newValues.resourceId !== undefined) {
          changes.push(`Resource: ${updatedParams.originalValues.resourceId} → ${updatedParams.newValues.resourceId}`);
        }
        finalChanges = changes.join(', ');
      }
      
      // Log the audit entry with final changes
      logFunction(updatedParams.page, updatedParams.action, updatedParams.description, finalChanges);
      
      // Remove from pending
      pendingAudits.delete(key);
    }, 3000); // 3 second delay
    
    // Update timer and latest params, keep original params
    pendingAudits.set(key, { 
      timer, 
      originalParams: existing.originalParams,
      latestParams: updatedParams 
    });
  } else {
    // First time - store both original and latest params (they're the same initially)
    const timer = setTimeout(() => {
      // Log the audit entry
      logFunction(params.page, params.action, params.description, params.changes);
      
      // Remove from pending
      pendingAudits.delete(key);
    }, 3000); // 3 second delay

    // Store the pending audit
    const paramsWithOriginals = params as AuditLogParamsWithOriginals;
    pendingAudits.set(key, { 
      timer, 
      originalParams: paramsWithOriginals,
      latestParams: paramsWithOriginals 
    });
  }
};

/**
 * Cancel a pending audit log (useful when component unmounts)
 * @param key - The key of the pending audit to cancel
 */
export const cancelPendingAudit = (key: string) => {
  const existing = pendingAudits.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pendingAudits.delete(key);
  }
};

/**
 * Flush all pending audits immediately (useful for critical actions like page navigation)
 */
export const flushPendingAudits = () => {
  pendingAudits.forEach(({ timer }) => {
    clearTimeout(timer);
  });
  pendingAudits.clear();
};