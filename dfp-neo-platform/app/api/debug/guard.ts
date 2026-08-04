import { NextResponse } from 'next/server';

export function debugRoutesDisabledResponse() {
  if (process.env.NODE_ENV === 'production' && process.env.DFP_ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}
