#!/usr/bin/env python3
"""
Script to add mobile API endpoints to DFP-NEO-V2-fresh/server.js
"""
import re

# Read the file
with open('DFP-NEO-V2-fresh/server.js', 'r') as f:
    content = f.read()

# JWT import code
jwt_import = """
// JWT for mobile API authentication
import jwt from 'jsonwebtoken';

function requireConfiguredSecret(name, developmentFallback) {
  const value = process.env[name];
  if (value && value.trim()) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured in production`);
  }
  console.warn(`⚠️ ${name} is not configured; using development-only fallback.`);
  return developmentFallback;
}

// JWT Configuration
const JWT_SECRET = requireConfiguredSecret('JWT_SECRET', 'dfp-neo-development-jwt-secret');
const JWT_ACCESS_EXPIRY = '1h';
const JWT_REFRESH_EXPIRY = '7d';
"""

# Insert JWT import after cookie-parser import
content = content.replace(
    "// Cookie parser\nconst cookieParser = require('cookie-parser');",
    "// Cookie parser\nconst cookieParser = require('cookie-parser');" + jwt_import
)

# Mobile API endpoints code
mobile_api_code = """

// ============================================================
// MOBILE API ENDPOINTS
// ============================================================

// Helper: Generate JWT tokens
function generateAccessTokens(userId) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
  return { accessToken, refreshToken };
}

// Helper: Verify JWT token and extract userId
function verifyJWT(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type === 'access' || decoded.type === 'refresh') {
      return decoded.userId;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Helper: Middleware to authenticate JWT tokens
function authenticateMobileJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const userId = verifyJWT(token);
  
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.userId = userId;
  next();
}

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
      console.log('❌ Mobile login failed: User not found for userId=' + loginUserId);
      return res.status(401).json({ 
        error: 'Invalid userId or password' 
      });
    }

    const user = users[0];

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ Mobile login failed: User ' + loginUserId + ' is not active');
      return res.status(403).json({ 
        error: 'Account is inactive' 
      });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('❌ Mobile login failed: Invalid password for userId=' + loginUserId);
      return res.status(401).json({ 
        error: 'Invalid userId or password' 
      });
    }

    // Map database role to iOS enum format
    let mappedRole = 'OTHER'; // default
    if (user.role) {
      const roleUpper = user.role.toUpperCase();
      if (roleUpper === 'ADMIN') {
        mappedRole = 'ADMIN';
      } else if (roleUpper === 'INSTRUCTOR' || roleUpper === 'STAFFINSTRUCTOR') {
        mappedRole = 'INSTRUCTOR';
      } else if (roleUpper === 'STUDENT' || roleUpper === 'TRAINEE') {
        mappedRole = 'STUDENT';
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateAccessTokens(user.userId);

    console.log('✅ Mobile login successful for userId=' + loginUserId);

    // Return success response
    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: mappedRole
      }
    });

  } catch (error) {
    console.error('❌ POST /api/mobile/auth/login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// POST /api/mobile/auth/refresh - Refresh access token
app.post('/api/mobile/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'refreshToken is required' 
      });
    }

    // Verify refresh token
    const userId = verifyJWT(refreshToken);

    if (!userId) {
      return res.status(401).json({ 
        error: 'Invalid or expired refresh token' 
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateAccessTokens(userId);

    console.log('✅ Mobile token refresh successful for userId=' + userId);

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('❌ POST /api/mobile/auth/refresh error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// GET /api/mobile/schedule - Get user's schedule (authenticated)
app.get('/api/mobile/schedule', authenticateMobileJWT, async (req, res) => {
  try {
    const db = await getPrisma();
    const userId = req.userId;
    const { startDate, endDate } = req.query;

    // Build query with optional date filters
    let query = `SELECT "scheduleId", "userId", "date", data FROM "Schedule" WHERE "userId" = $1`;
    let params = [userId];
    
    if (startDate) {
      query += ` AND "date" >= $${params.length + 1}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND "date" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += ` ORDER BY "date" ASC`;

    const schedules = await db.$queryRawUnsafe(query, ...params);

    // Transform schedules to match iOS expected format
    const transformedSchedules = schedules.map(schedule => {
      return {
        scheduleId: schedule.scheduleId,
        userId: schedule.userId,
        date: schedule.date,
        data: schedule.data || {}
      };
    });

    console.log('✅ GET /api/mobile/schedule successful for userId=' + userId + ' - Found ' + transformedSchedules.length + ' schedules');

    res.json({
      success: true,
      schedules: transformedSchedules
    });

  } catch (error) {
    console.error('❌ GET /api/mobile/schedule error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});
"""

# Find a good place to insert the mobile API endpoints
# Look for the end of the API endpoints section or before server.listen
if "app.listen(" in content:
    # Insert before app.listen
    content = content.replace(
        "app.listen(",
        mobile_api_code + "\n\napp.listen("
    )
else:
    # If no app.listen found, append to the end
    content += mobile_api_code

# Write the modified content back
with open('DFP-NEO-V2-fresh/server.js', 'w') as f:
    f.write(content)

print("✅ Successfully added mobile API endpoints to DFP-NEO-V2-fresh/server.js")
