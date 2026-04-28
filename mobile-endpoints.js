// ============================================================
// MOBILE API ENDPOINTS - Add this section after the existing /api/auth/verify-password endpoint
// ============================================================

// POST /api/mobile/auth/login - Mobile JWT login
app.post('/api/mobile/auth/login', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId: loginUserId, password } = req.body;

    if (!loginUserId || !password) {
      return res.status(400).json({ 
        error: 'userId and password are required' 
      });
    }

    // Find user by userId
    const users = await db.$queryRawUnsafe(
      `SELECT id, "userId", "firstName", "lastName", email, "role", "isActive", password FROM "User" WHERE "userId" = $1`,
      loginUserId
    );

    if (!users || users.length === 0) {
      console.log(`❌ Mobile login failed: User not found for userId=${loginUserId}`);
      return res.status(401).json({ 
        error: 'Invalid userId or password' 
      });
    }

    const user = users[0];

    // Check if user is active
    if (!user.isActive) {
      console.log(`❌ Mobile login failed: User ${loginUserId} is not active`);
      return res.status(403).json({ 
        error: 'Account is inactive' 
      });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log(`❌ Mobile login failed: Invalid password for userId=${loginUserId}`);
      return res.status(401).json({ 
        error: 'Invalid userId or password' 
      });
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateAccessTokens(user.userId);

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Map role to iOS enum format
    const roleMap = {
      'SUPER_ADMIN': 'ADMIN',
      'ADMIN': 'ADMIN',
      'INSTRUCTOR': 'INSTRUCTOR',
      'USER': 'STUDENT',
      'PILOT': 'OTHER'
    };
    const iOSRole = roleMap[user.role] || 'OTHER';

    console.log(`✅ Mobile login successful for userId=${loginUserId}, role=${user.role}`);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.userId,
        userId: user.userId,
        displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        isActive: user.isActive,
        role: iOSRole
      }
    });
  } catch (error) {
    console.error('❌ POST /api/mobile/auth/login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// POST /api/mobile/auth/refresh - Refresh JWT access token
app.post('/api/mobile/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    const userId = verifyJWT(refreshToken);

    if (!userId) {
      console.log('❌ Mobile refresh failed: Invalid or expired refresh token');
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Verify user exists and is active
    const db = await getPrisma();
    const users = await db.$queryRawUnsafe(
      `SELECT id, "userId", "isActive" FROM "User" WHERE "userId" = $1`,
      userId
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateAccessTokens(user.userId);

    console.log(`✅ Mobile refresh successful for userId=${userId}`);

    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('❌ POST /api/mobile/auth/refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed', details: error.message });
  }
});

// Middleware: Verify JWT for protected mobile routes
function authenticateMobileJWT(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  const userId = verifyJWT(token);

  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }

  req.mobileUserId = userId;
  next();
}

// GET /api/mobile/schedule - Get user's schedule for a specific date
app.get('/api/mobile/schedule', authenticateMobileJWT, async (req, res) => {
  try {
    const db = await getPrisma();
    const userId = req.mobileUserId;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ 
        error: 'Date parameter is required (format: YYYY-MM-DD)' 
      });
    }

    // Find schedule for this user and date
    const schedules = await db.schedule.findMany({
      where: {
        userId: userId,
        date: date
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (!schedules || schedules.length === 0) {
      console.log(`ℹ️ No schedule found for userId=${userId}, date=${date}`);
      return res.json({
        events: [],
        message: `No schedule found for this date.`
      });
    }

    // Get the most recent schedule for this date
    const schedule = schedules[0];

    // Extract events from schedule data
    const events = (schedule.data && schedule.data.events) ? schedule.data.events : [];

    console.log(`✅ Mobile schedule retrieved for userId=${userId}, date=${date}, events=${events.length}`);

    res.json({
      events: events,
      message: `Found ${events.length} events for ${date}`
    });
  } catch (error) {
    console.error('❌ GET /api/mobile/schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch schedule', details: error.message });
  }
});

// ============================================================
// END MOBILE API ENDPOINTS
// ============================================================