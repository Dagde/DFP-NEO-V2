import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // For JWT-based auth, logout is handled client-side by deleting tokens
    // We could implement a token blacklist here if needed in the future
    
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Mobile logout error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}