import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://dfp-neo-v2-production.up.railway.app',
  'https://dfp-neo.com',
];

const DEVELOPMENT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, Cookie, X-Requested-With';

const parseOrigins = (value?: string | null): string[] => (
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const allowedOrigins = (): Set<string> => {
  const configured = parseOrigins(process.env.DFP_NEO_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS);
  const origins = configured.length > 0 ? [...configured] : [...DEFAULT_ALLOWED_ORIGINS];
  if (process.env.NODE_ENV !== 'production') {
    origins.push(...DEVELOPMENT_ALLOWED_ORIGINS);
  }
  return new Set(origins);
};

export const isCorsOriginAllowed = (request: NextRequest): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === request.nextUrl.origin) return true;
  return allowedOrigins().has(origin);
};

export const getCorsHeaders = (request: NextRequest): HeadersInit => {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': request.headers.get('access-control-request-headers') || CORS_HEADERS,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && isCorsOriginAllowed(request)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
};

export const rejectDisallowedCorsOrigin = (request: NextRequest): NextResponse | null => {
  if (isCorsOriginAllowed(request)) return null;
  return NextResponse.json(
    { error: 'CORS origin not allowed' },
    { status: 403, headers: { Vary: 'Origin' } },
  );
};
