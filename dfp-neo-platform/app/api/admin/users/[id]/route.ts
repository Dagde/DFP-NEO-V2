import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

// Mock user data (same as in the main users route)
const mockUsers = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@dfp-neo.com',
    role: 'ADMIN',
    firstName: 'System',
    lastName: 'Administrator',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: '2',
    username: 'john.pilot',
    email: 'john.pilot@dfp-neo.com',
    role: 'PILOT',
    firstName: 'John',
    lastName: 'Smith',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: null,
  },
  {
    id: '3',
    username: 'jane.instructor',
    email: 'jane.instructor@dfp-neo.com',
    role: 'INSTRUCTOR',
    firstName: 'Jane',
    lastName: 'Wilson',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: null,
  }
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isActive } = body;

    const userIndex = mockUsers.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user
    if (body.hasOwnProperty('isActive')) {
      mockUsers[userIndex].isActive = isActive;
      console.log(`🔄 User ${mockUsers[userIndex].username} ${isActive ? 'activated' : 'deactivated'}`);
    }

    return NextResponse.json({
      id: mockUsers[userIndex].id,
      username: mockUsers[userIndex].username,
      isActive: mockUsers[userIndex].isActive,
    });
    
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userIndex = mockUsers.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const deletedUser = mockUsers[userIndex];
    mockUsers.splice(userIndex, 1);

    console.log(`🗑️ Deleted user: ${deletedUser.username}`);

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}