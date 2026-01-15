import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // This will show us the actual schema of the Personnel table
    const response = await fetch(`${process.env.RAILWAY_DATABASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'Personnel'
          ORDER BY ordinal_position;
        `
      })
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
