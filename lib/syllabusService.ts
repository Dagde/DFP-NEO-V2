/**
 * Syllabus Service
 * Loads syllabus from database at app startup and caches in localStorage.
 * Provides fast in-memory access during session with graceful fallback.
 */

import { SyllabusItemDetail } from '../types';
import { normaliseIntegratedCombatOperationsTimings } from '../utils/airCombatTraining';

const API_BASE = '/api';
const CACHE_KEY = 'dfp-syllabus-cache';
const CACHE_TIMESTAMP_KEY = 'dfp-syllabus-cache-timestamp';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
// Increment this version when DB schema/data migrations change the syllabus structure.
// Old caches with a different version are automatically invalidated on next load.
const CACHE_VERSION = '10'; // v10: Integrated Combat Operations duration follows flight/sim hours
const CACHE_VERSION_KEY = 'dfp-syllabus-cache-version';

// ============================================================================
// CACHE HELPERS
// ============================================================================

function getCachedSyllabus(): { data: SyllabusItemDetail[]; expired: boolean } | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const version = localStorage.getItem(CACHE_VERSION_KEY);
    if (!raw || !timestamp) return null;

    // Invalidate cache if version doesn't match (DB migration changed data structure)
    if (version !== CACHE_VERSION) {
      console.log(`[Syllabus Cache] Version mismatch (cached: ${version}, current: ${CACHE_VERSION}) — invalidating cache`);
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      localStorage.removeItem(CACHE_VERSION_KEY);
      return null;
    }

    const data = normaliseIntegratedCombatOperationsTimings(JSON.parse(raw) as SyllabusItemDetail[]);
    const age = Date.now() - parseInt(timestamp, 10);
    const expired = age > CACHE_TTL_MS;

    return { data, expired };
  } catch {
    return null;
  }
}

function setCachedSyllabus(syllabus: SyllabusItemDetail[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(syllabus));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
  } catch (e) {
    console.warn('⚠️ Could not cache syllabus in localStorage:', e);
  }
}

export function clearSyllabusCache(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
  } catch {}
}

// ============================================================================
// PREREQUISITE PROCESSING (same logic as mockData.ts)
// ============================================================================

function populatePrerequisites(items: SyllabusItemDetail[]): SyllabusItemDetail[] {
  return items.map((item, index, arr) => {
    const itemWithDefaults = {
      ...item,
      acceptableAircraftConfigs: Array.isArray(item.acceptableAircraftConfigs) && item.acceptableAircraftConfigs.length > 0
        ? item.acceptableAircraftConfigs
        : ['ANY'],
      assessedElements: Array.isArray(item.assessedElements) && item.assessedElements.length > 0
        ? item.assessedElements
        : ['Airmanship', 'Preparation', 'Technique'],
    };
    const hasExplicitPrereqs =
      (item.prerequisitesGround && item.prerequisitesGround.length > 0) ||
      (item.prerequisitesFlying && item.prerequisitesFlying.length > 0);

    if (hasExplicitPrereqs || item.lmpType === 'Master LMP') {
      return itemWithDefaults;
    }

    const prerequisitesGround: string[] = [];
    const prerequisitesFlying: string[] = [];

    for (let i = index - 1; i >= 0; i--) {
      const prereqCandidate = arr[i];
      if (prereqCandidate.code.includes(' MB')) continue;
      const sharedCourses = prereqCandidate.courses.some((c: string) => item.courses.includes(c));
      if (!sharedCourses) break;

      if (prereqCandidate.type === 'Flight' || prereqCandidate.type === 'FTD') {
        prerequisitesFlying.push(prereqCandidate.code);
      } else {
        prerequisitesGround.push(prereqCandidate.code);
      }
      break;
    }

    return {
      ...item,
      acceptableAircraftConfigs: itemWithDefaults.acceptableAircraftConfigs,
      prerequisitesGround,
      prerequisitesFlying,
      prerequisites: [...prerequisitesGround, ...prerequisitesFlying],
    };
  });
}

// ============================================================================
// MAIN FETCH FUNCTION
// ============================================================================

export interface SyllabusLoadResult {
  syllabus: SyllabusItemDetail[];
  source: 'database' | 'cache' | 'expired-cache' | 'empty';
  error?: string;
}

export async function loadSyllabusFromDB(): Promise<SyllabusLoadResult> {
  // 1. Try fresh cache first
  const cached = getCachedSyllabus();
  if (cached && !cached.expired) {
    console.log(`📚 [Syllabus] Using fresh cache (${cached.data.length} items)`);
    return { syllabus: cached.data, source: 'cache' };
  }

  // 2. Try fetching from database
  try {
    console.log('📚 [Syllabus] Fetching from database...');
    const response = await fetch(`${API_BASE}/syllabus`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const rawItems: SyllabusItemDetail[] = data.syllabus || data.syllabusItems || [];

    if (rawItems.length === 0) {
      throw new Error('No syllabus items returned from database');
    }

    // Process prerequisites (already stored in DB, but re-process for consistency)
    const processed = normaliseIntegratedCombatOperationsTimings(populatePrerequisites(rawItems));

    // Cache the result
    setCachedSyllabus(processed);

    console.log(`📚 [Syllabus] Loaded ${processed.length} items from database`);
    return { syllabus: processed, source: 'database' };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Syllabus] Database fetch failed: ${errMsg}`);

    // 3. Fall back to expired cache if available
    if (cached && cached.expired) {
      console.warn(`⚠️ [Syllabus] Using expired cache as fallback (${cached.data.length} items)`);
      return {
        syllabus: cached.data,
        source: 'expired-cache',
        error: `Database unavailable - showing cached syllabus. Error: ${errMsg}`,
      };
    }

    // 4. No cache available at all
    console.error('❌ [Syllabus] No cache available - returning empty syllabus');
    return {
      syllabus: [],
      source: 'empty',
      error: `Failed to load syllabus: ${errMsg}`,
    };
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function createSyllabusItem(
  item: Partial<SyllabusItemDetail>,
  changeReason?: string
): Promise<SyllabusItemDetail> {
  const response = await fetch(`${API_BASE}/syllabus`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...item, changeReason }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create syllabus item');
  }

  const data = await response.json();
  clearSyllabusCache(); // Invalidate cache after change
  return data.syllabusItem;
}

export async function updateSyllabusItem(
  id: string,
  updates: Partial<SyllabusItemDetail>,
  changeReason?: string
): Promise<SyllabusItemDetail> {
  const response = await fetch(`${API_BASE}/syllabus/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...updates, changeReason }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update syllabus item');
  }

  const data = await response.json();
  clearSyllabusCache(); // Invalidate cache after change
  return data.syllabusItem;
}

export async function retireSyllabusItem(
  id: string,
  changeReason?: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/syllabus/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changeReason }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to retire syllabus item');
  }

  clearSyllabusCache(); // Invalidate cache after change
}

// ============================================================================
// UTILITY
// ============================================================================

/** Find a single syllabus item by code from a loaded syllabus array */
export function findByCode(
  syllabus: SyllabusItemDetail[],
  code: string
): SyllabusItemDetail | undefined {
  return syllabus.find(s => s.code === code);
}

/** Get all items for a specific course */
export function filterByCourse(
  syllabus: SyllabusItemDetail[],
  course: string
): SyllabusItemDetail[] {
  return syllabus.filter(s => s.courses.includes(course));
}

/** Get all items for a specific phase */
export function filterByPhase(
  syllabus: SyllabusItemDetail[],
  phase: string
): SyllabusItemDetail[] {
  return syllabus.filter(s => s.phase === phase);
}
