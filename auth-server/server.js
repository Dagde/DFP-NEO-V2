/**
 * DFP-NEO Authentication Server
 * Lightweight Express.js server providing auth endpoints for the Vite app
 * 
 * Endpoints:
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   POST /api/auth/change-password
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 *   GET  /api/auth/session
 *   GET  /api/admin/users
 *   POST /api/admin/reset-user-password
 *   POST /api/admin/create-user
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.AUTH_PORT || 3001;

// Database path - use dfp-neo-v2 database
const DB_PATH = path.join(__dirname, '../dfp-neo-v2/prisma/dev.db');

// Session store (in-memory for now, keyed by sessionToken)
const sessions = new Map();

// Session expiry: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Rate limiting: track failed login attempts
const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ============================================================
// Middleware
// ============================================================

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:3003', '*'],
  credentials: true,
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// Database helpers
// ============================================================

function getDb() {
  return new Database(DB_PATH);
}

function generateCuid() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return 'c' + timestamp + random;
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================================
// Auth middleware
// ============================================================

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || req.headers['x-session-token'];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No session token provided' });
  }

  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session' });
  }

  if (new Date() > new Date(session.expires)) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized', message: 'Session expired' });
  }

  req.user = session.user;
  req.sessionToken = token;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
    next();
  });
}

// ============================================================
// Rate limiting helpers
// ============================================================

function checkRateLimit(userId) {
  const key = userId.toLowerCase();
  const attempts = loginAttempts.get(key);
  
  if (!attempts) return { allowed: true };
  
  if (attempts.count >= MAX_ATTEMPTS) {
    const lockoutEnd = new Date(attempts.lastAttempt.getTime() + LOCKOUT_MS);
    if (new Date() < lockoutEnd) {
      const remainingMs = lockoutEnd - new Date();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return { 
        allowed: false, 
        message: `Account temporarily locked. Try again in ${remainingMin} minute(s).` 
      };
    } else {
      // Lockout expired, reset
      loginAttempts.delete(key);
      return { allowed: true };
    }
  }
  
  return { allowed: true };
}

function recordFailedAttempt(userId) {
  const key = userId.toLowerCase();
  const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: new Date() };
  attempts.count++;
  attempts.lastAttempt = new Date();
  loginAttempts.set(key, attempts);
}

function clearLoginAttempts(userId) {
  loginAttempts.delete(userId.toLowerCase());
}

// ============================================================
// Email helper
// ============================================================

async function sendPasswordResetEmail(email, userId, resetToken) {
  // For now, log the reset link (email sending can be configured later)
  const resetLink = `http://localhost:8080/reset-password?token=${resetToken}`;
  console.log(`\n📧 PASSWORD RESET EMAIL`);
  console.log(`   To: ${email}`);
  console.log(`   User: ${userId}`);
  console.log(`   Reset Link: ${resetLink}`);
  console.log(`   Token: ${resetToken}`);
  console.log(`   Expires: ${new Date(Date.now() + 30 * 60 * 1000).toISOString()}\n`);
  
  // Try to send via Gmail if configured
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      
      await transporter.sendMail({
        from: `DFP-NEO <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'DFP-NEO Password Reset',
        html: `
          <h2>DFP-NEO Password Reset</h2>
          <p>A password reset was requested for your account (${userId}).</p>
          <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
          <a href="${resetLink}" style="background:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a>
          <p>If you did not request this, please ignore this email.</p>
          <p>Reset token: <code>${resetToken}</code></p>
        `,
      });
      console.log('   ✅ Email sent successfully');
    } catch (err) {
      console.error('   ❌ Email send failed:', err.message);
    }
  }
  
  return { resetLink, token: resetToken };
}

// ============================================================
// Routes
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- POST /api/auth/login ----
app.post('/api/auth/login', async (req, res) => {
  const { userId, password } = req.body;
  
  if (!userId || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId and password are required' });
  }
  
  // Rate limit check
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too Many Requests', message: rateLimit.message });
  }
  
  const db = getDb();
  try {
    // Find user by userId
    const user = db.prepare('SELECT * FROM User WHERE userId = ? AND isActive = 1').get(userId);
    
    if (!user) {
      recordFailedAttempt(userId);
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid user ID or password' });
    }
    
    // Check password (try both passwordHash and password fields)
    const passwordToCheck = user.passwordHash || user.password;
    if (!passwordToCheck) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Password not set. Contact administrator.' });
    }
    
    const isValid = await bcrypt.compare(password, passwordToCheck);
    if (!isValid) {
      recordFailedAttempt(userId);
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid user ID or password' });
    }
    
    // Clear failed attempts
    clearLoginAttempts(userId);
    
    // Create session
    const sessionToken = generateSessionToken();
    const expires = new Date(Date.now() + SESSION_EXPIRY_MS);
    
    const sessionUser = {
      id: user.id,
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      mustChangePassword: user.mustChangePassword === 1 || user.mustChangePassword === true,
      permissionsRoleId: user.permissionsRoleId,
    };
    
    sessions.set(sessionToken, {
      user: sessionUser,
      expires: expires.toISOString(),
      createdAt: new Date().toISOString(),
    });
    
    // Store session in database
    const sessionId = generateCuid();
    db.prepare(`
      INSERT INTO Session (id, sessionToken, userId, expires)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, sessionToken, user.id, expires.toISOString());
    
    // Update last login
    db.prepare('UPDATE User SET lastLoginAt = ? WHERE id = ?').run(new Date().toISOString(), user.id);
    
    // Log audit
    const auditId = generateCuid();
    db.prepare(`
      INSERT INTO AuditLog (id, actorUserId, actionType, targetUserId, createdAt)
      VALUES (?, ?, 'LOGIN', ?, ?)
    `).run(auditId, user.id, user.id, new Date().toISOString());
    
    console.log(`✅ Login successful: ${userId} (${user.role})`);
    
    return res.json({
      sessionToken,
      expires: expires.toISOString(),
      user: sessionUser,
      mustChangePassword: sessionUser.mustChangePassword,
    });
    
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Login failed' });
  } finally {
    db.close();
  }
});

// ---- POST /api/auth/logout ----
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.sessionToken;
  const userId = req.user.userId;
  
  // Remove from memory
  sessions.delete(token);
  
  // Remove from database
  const db = getDb();
  try {
    db.prepare('DELETE FROM Session WHERE sessionToken = ?').run(token);
    
    // Log audit
    const auditId = generateCuid();
    db.prepare(`
      INSERT INTO AuditLog (id, actorUserId, actionType, targetUserId, createdAt)
      VALUES (?, ?, 'LOGOUT', ?, ?)
    `).run(auditId, req.user.id, req.user.id, new Date().toISOString());
    
    console.log(`✅ Logout: ${userId}`);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    db.close();
  }
});

// ---- GET /api/auth/session ----
app.get('/api/auth/session', requireAuth, (req, res) => {
  return res.json({
    user: req.user,
    expires: sessions.get(req.sessionToken)?.expires,
  });
});

// ---- POST /api/auth/change-password ----
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Bad Request', message: 'currentPassword and newPassword are required' });
  }
  
  // Validate new password strength
  const errors = validatePasswordStrength(newPassword);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password too weak', errors });
  }
  
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM User WHERE id = ?').get(req.user.id);
    
    const passwordToCheck = user.passwordHash || user.password;
    const isValid = await bcrypt.compare(currentPassword, passwordToCheck);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Current password is incorrect' });
    }
    
    const newHash = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE User SET passwordHash = ?, password = ?, mustChangePassword = 0, passwordSetAt = ?, updatedAt = ?
      WHERE id = ?
    `).run(newHash, newHash, now, now, req.user.id);
    
    // Invalidate all other sessions for this user
    const userSessions = db.prepare('SELECT sessionToken FROM Session WHERE userId = ?').all(req.user.id);
    userSessions.forEach(s => {
      if (s.sessionToken !== req.sessionToken) {
        sessions.delete(s.sessionToken);
      }
    });
    db.prepare('DELETE FROM Session WHERE userId = ? AND sessionToken != ?').run(req.user.id, req.sessionToken);
    
    // Update current session user
    const currentSession = sessions.get(req.sessionToken);
    if (currentSession) {
      currentSession.user.mustChangePassword = false;
      sessions.set(req.sessionToken, currentSession);
    }
    
    // Log audit
    const auditId = generateCuid();
    db.prepare(`
      INSERT INTO AuditLog (id, actorUserId, actionType, targetUserId, createdAt)
      VALUES (?, ?, 'PASSWORD_CHANGE', ?, ?)
    `).run(auditId, req.user.id, req.user.id, now);
    
    console.log(`✅ Password changed: ${req.user.userId}`);
    return res.json({ success: true, message: 'Password changed successfully' });
    
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    db.close();
  }
});

// ---- POST /api/auth/forgot-password ----
app.post('/api/auth/forgot-password', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId is required' });
  }
  
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM User WHERE userId = ? AND isActive = 1').get(userId);
    
    // Always return success to prevent user enumeration
    if (!user || !user.email) {
      console.log(`Password reset requested for unknown/no-email user: ${userId}`);
      return res.json({ success: true, message: 'If the account exists, a reset email has been sent.' });
    }
    
    // Generate reset token
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    // Store token in database
    const tokenId = generateCuid();
    
    // Check if PasswordResetToken table has tokenHash or token column
    const tableInfo = db.prepare("PRAGMA table_info(PasswordResetToken)").all();
    const hasTokenHash = tableInfo.some(col => col.name === 'tokenHash');
    const tokenColumn = hasTokenHash ? 'tokenHash' : 'token';
    const expiresColumn = tableInfo.some(col => col.name === 'expiresAt') ? 'expiresAt' : 'expires';
    
    db.prepare(`
      INSERT INTO PasswordResetToken (id, userId, ${tokenColumn}, ${expiresColumn}, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenId, user.id, tokenHash, expires.toISOString(), new Date().toISOString());
    
    // Send email
    await sendPasswordResetEmail(user.email, userId, rawToken);
    
    // Log audit
    const auditId = generateCuid();
    db.prepare(`
      INSERT INTO AuditLog (id, actorUserId, actionType, targetUserId, createdAt)
      VALUES (?, ?, 'PASSWORD_RESET_REQUEST', ?, ?)
    `).run(auditId, user.id, user.id, new Date().toISOString());
    
    return res.json({ 
      success: true, 
      message: 'If the account exists, a reset email has been sent.',
      // In development, also return the token for testing
      ...(process.env.NODE_ENV !== 'production' && { devToken: rawToken, devLink: `http://localhost:8080/reset-password?token=${rawToken}` })
    });
    
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    db.close();
  }
});

// ---- POST /api/auth/reset-password ----
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Bad Request', message: 'token and newPassword are required' });
  }
  
  // Validate new password strength
  const errors = validatePasswordStrength(newPassword);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password too weak', errors });
  }
  
  const db = getDb();
  try {
    const tokenHash = hashToken(token);
    
    // Check table structure
    const tableInfo = db.prepare("PRAGMA table_info(PasswordResetToken)").all();
    const hasTokenHash = tableInfo.some(col => col.name === 'tokenHash');
    const tokenColumn = hasTokenHash ? 'tokenHash' : 'token';
    const expiresColumn = tableInfo.some(col => col.name === 'expiresAt') ? 'expiresAt' : 'expires';
    const usedColumn = tableInfo.some(col => col.name === 'usedAt') ? 'usedAt' : 'used';
    
    const resetToken = db.prepare(`
      SELECT * FROM PasswordResetToken WHERE ${tokenColumn} = ?
    `).get(tokenHash);
    
    if (!resetToken) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired reset token' });
    }
    
    // Check if already used
    const isUsed = usedColumn === 'usedAt' ? resetToken.usedAt !== null : resetToken.used;
    if (isUsed) {
      return res.status(400).json({ error: 'Bad Request', message: 'Reset token has already been used' });
    }
    
    // Check expiry
    if (new Date() > new Date(resetToken[expiresColumn])) {
      return res.status(400).json({ error: 'Bad Request', message: 'Reset token has expired' });
    }
    
    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();
    
    // Update password
    db.prepare(`
      UPDATE User SET passwordHash = ?, password = ?, mustChangePassword = 0, passwordSetAt = ?, updatedAt = ?
      WHERE id = ?
    `).run(newHash, newHash, now, now, resetToken.userId);
    
    // Mark token as used
    if (usedColumn === 'usedAt') {
      db.prepare('UPDATE PasswordResetToken SET usedAt = ? WHERE id = ?').run(now, resetToken.id);
    } else {
      db.prepare('UPDATE PasswordResetToken SET used = 1 WHERE id = ?').run(resetToken.id);
    }
    
    // Invalidate all sessions for this user
    const userSessions = db.prepare('SELECT sessionToken FROM Session WHERE userId = ?').all(resetToken.userId);
    userSessions.forEach(s => sessions.delete(s.sessionToken));
    db.prepare('DELETE FROM Session WHERE userId = ?').run(resetToken.userId);
    
    // Log audit
    const auditId = generateCuid();
    db.prepare(`
      INSERT INTO AuditLog (id, actorUserId, actionType, targetUserId, createdAt)
      VALUES (?, ?, 'PASSWORD_RESET', ?, ?)
    `).run(auditId, resetToken.userId, resetToken.userId, now);
    
    console.log(`✅ Password reset successful for user ID: ${resetToken.userId}`);
    return res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
    
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    db.close();
  }
});

// ---- GET /api/admin/users ----
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const db = getDb();
  try {
    const users = db.prepare(`
      SELECT id, userId, username, email, role, firstName, lastName, displayName, 
             isActive, mustChangePassword, lastLoginAt, createdAt, permissionsRoleId
      FROM User ORDER BY createdAt ASC
    `).all();
    
    return res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    db.close();
  }
});

// ---- POST /api/admin/reset-user-password ----
app.post('/api/admin/reset-user-password', requireAdmin, async (req, res) => {
  const { targetUserId, newPassword, mustChangePassword = true } = req.body;
  
  if (!targetUserId || !newPassword) {
    return res.status(400).json({ error: 'Bad Request', message: 'targetUserId and newPassword are required' });
  }
  
  const db = getDb();
  try {
    const targetUser = db.prepare('SELECT * FROM User WHERE userId = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    
    const newHash = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE User SET passwordHash = ?, password = ?, mustChangePassword = ?, passwordSetAt = ?, updatedAt = ?
      WHERE userId = ?
    `).run(newHash, newHash, mustChangePassword ? 1 : 0, now, now, targetUserId);
    
    // Invalidate all sessions for target user
    const userSessions = db.prepare('SELECT sessionToken FROM Session WHERE userId = ?').all(targetUser.id);
    userSessions.forEach(s => sessions.delete(s.sessionToken));
    db.prepare('DELETE FROM Session WHERE userId = ?').run(targetUser.id);
    
    // Log audit
    const auditId = generateCuid();
    db.prepare(`
      INSERT INTO AuditLog (id, actorUserId, actionType, targetUserId, metadata, createdAt)
      VALUES (?, ?, 'ADMIN_PASSWORD_RESET', ?, ?, ?)
    `).run(auditId, req.user.id, targetUser.id, JSON.stringify({ resetBy: req.user.userId, targetUser: targetUserId }), now);
    
    console.log(`✅ Admin password reset: ${req.user.userId} reset password for ${targetUserId}`);
    return res.json({ success: true, message: `Password reset for ${targetUserId}` });
    
  } catch (err) {
    console.error('Admin reset password error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    db.close();
  }
});

// ---- POST /api/admin/create-user ----
app.post('/api/admin/create-user', requireAdmin, async (req, res) => {
  const { userId, password, email, firstName, lastName, role = 'USER', mustChangePassword = true } = req.body;
  
  if (!userId || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId and password are required' });
  }
  
  const db = getDb();
  try {
    // Check if userId already exists
    const existing = db.prepare('SELECT id FROM User WHERE userId = ?').get(userId);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'User ID already exists' });
    }
    
    // Get default permissions role
    const defaultRole = db.prepare("SELECT id FROM PermissionsRole WHERE name = 'Instructor'").get();
    const permissionsRoleId = defaultRole?.id;
    
    if (!permissionsRoleId) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Could not find default permissions role' });
    }
    
    const newHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const newId = generateCuid();
    const displayName = `${firstName || ''} ${lastName || ''}`.trim() || userId;
    
    db.prepare(`
      INSERT INTO User (id, userId, username, email, passwordHash, password, displayName, firstName, lastName, 
                        role, isActive, mustChangePassword, status, permissionsRoleId, createdById, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'active', ?, ?, ?, ?)
    `).run(newId, userId, userId, email || null, newHash, newHash, displayName, 
           firstName || null, lastName || null, role, mustChangePassword ? 1 : 0, 
           permissionsRoleId, req.user.id, now, now);
    
    // Log audit
    const auditId = generateCuid();
    db.prepare(`
      INSERT INTO AuditLog (id, actorUserId, actionType, targetUserId, metadata, createdAt)
      VALUES (?, ?, 'CREATE_USER', ?, ?, ?)
    `).run(auditId, req.user.id, newId, JSON.stringify({ createdBy: req.user.userId, newUser: userId }), now);
    
    console.log(`✅ User created: ${userId} by ${req.user.userId}`);
    return res.status(201).json({ 
      success: true, 
      message: `User ${userId} created successfully`,
      user: { id: newId, userId, email, firstName, lastName, role }
    });
    
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    db.close();
  }
});

// ============================================================
// Password validation helper
// ============================================================

function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  return errors;
}

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {
  console.log(`\n🚀 DFP-NEO Auth Server running on port ${PORT}`);
  console.log(`   Database: ${DB_PATH}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`\n   Credentials:`);
  console.log(`   SuperAdmin: superadmin / Bathurst063371526`);
  console.log(`   Alexander Burns: alexander.burns / Burns8201112\n`);
});

module.exports = app;