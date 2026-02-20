/**
 * Script to create initial users in both SQLite databases
 * SuperAdmin and Alexander Burns
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Pre-computed bcrypt hashes (cost factor 12)
// SuperAdmin: Bathurst063371526
const SUPERADMIN_HASH = '$2a$12$Ys2mqJE3O6dtUgHtB6D7.ewK0nDSx6cW9KQM6nsrrnt4dNzY0Zh26';
// Alexander Burns: Burns8201112
const BURNS_HASH = '$2a$12$a6SwU4hgw0rJYro0yMwqB.a2SemmVjpJT54aLAsKKjY/4IigiPpa2';

// PermissionsRole IDs (from database)
// These will be looked up dynamically per database

function generateCuid() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return 'c' + timestamp + random;
}

function createUsers(dbPath) {
  console.log(`\nProcessing database: ${dbPath}`);
  
  let db;
  try {
    db = new Database(dbPath);
  } catch (err) {
    console.error(`  ERROR: Could not open database: ${err.message}`);
    return;
  }

  // Check existing users
  const existingUsers = db.prepare('SELECT userId, username, role FROM User').all();
  console.log(`  Existing users: ${existingUsers.length}`);
  existingUsers.forEach(u => console.log(`    - ${u.userId} (${u.username || 'no username'}) [${u.role}]`));

  const now = new Date().toISOString();

  // Look up PermissionsRole IDs dynamically
  const adminRole = db.prepare("SELECT id FROM PermissionsRole WHERE name = 'Administrator'").get();
  const instructorRole = db.prepare("SELECT id FROM PermissionsRole WHERE name = 'Instructor'").get();
  
  if (!adminRole || !instructorRole) {
    console.error('  ERROR: Could not find required PermissionsRole entries');
    console.log('  Available roles:', db.prepare('SELECT id, name FROM PermissionsRole').all());
    db.close();
    return;
  }
  
  const adminRoleId = adminRole.id;
  const instructorRoleId = instructorRole.id;
  console.log(`  Using Administrator role ID: ${adminRoleId}`);
  console.log(`  Using Instructor role ID: ${instructorRoleId}`);

  // Create SuperAdmin user
  const superAdminExists = db.prepare('SELECT id FROM User WHERE userId = ?').get('superadmin');
  if (superAdminExists) {
    console.log('  SuperAdmin already exists - updating password and role...');
    db.prepare(`
      UPDATE User SET 
        passwordHash = ?,
        password = ?,
        role = 'SUPER_ADMIN',
        isActive = 1,
        mustChangePassword = 0,
        email = ?,
        displayName = 'Super Admin',
        firstName = 'Super',
        lastName = 'Admin',
        username = 'superadmin',
        permissionsRoleId = ?,
        updatedAt = ?
      WHERE userId = 'superadmin'
    `).run(SUPERADMIN_HASH, SUPERADMIN_HASH, 'lifeofiron2015@gmail.com', adminRoleId, now);
    console.log('  ✅ SuperAdmin updated');
  } else {
    const superAdminId = generateCuid();
    db.prepare(`
      INSERT INTO User (id, userId, username, email, passwordHash, password, displayName, firstName, lastName, role, isActive, mustChangePassword, status, permissionsRoleId, createdAt, updatedAt)
      VALUES (?, 'superadmin', 'superadmin', 'lifeofiron2015@gmail.com', ?, ?, 'Super Admin', 'Super', 'Admin', 'SUPER_ADMIN', 1, 0, 'active', ?, ?, ?)
    `).run(superAdminId, SUPERADMIN_HASH, SUPERADMIN_HASH, adminRoleId, now, now);
    console.log('  ✅ SuperAdmin created');
  }

  // Create Alexander Burns user
  // Note: Using burns.alexander@sample.com.au since email must be unique
  // Both users have lifeofiron2015@gmail.com as their recovery email (stored in notes)
  const burnsExists = db.prepare('SELECT id FROM User WHERE userId = ?').get('alexander.burns');
  if (burnsExists) {
    console.log('  Alexander Burns already exists - updating password and role...');
    db.prepare(`
      UPDATE User SET 
        passwordHash = ?,
        password = ?,
        role = 'INSTRUCTOR',
        isActive = 1,
        mustChangePassword = 0,
        email = ?,
        displayName = 'Alexander Burns',
        firstName = 'Alexander',
        lastName = 'Burns',
        username = 'alexander.burns',
        permissionsRoleId = ?,
        updatedAt = ?
      WHERE userId = 'alexander.burns'
    `).run(BURNS_HASH, BURNS_HASH, 'burns.alexander@sample.com.au', instructorRoleId, now);
    console.log('  ✅ Alexander Burns updated');
  } else {
    const burnsId = generateCuid();
    db.prepare(`
      INSERT INTO User (id, userId, username, email, passwordHash, password, displayName, firstName, lastName, role, isActive, mustChangePassword, status, permissionsRoleId, createdAt, updatedAt)
      VALUES (?, 'alexander.burns', 'alexander.burns', 'burns.alexander@sample.com.au', ?, ?, 'Alexander Burns', 'Alexander', 'Burns', 'INSTRUCTOR', 1, 0, 'active', ?, ?, ?)
    `).run(burnsId, BURNS_HASH, BURNS_HASH, instructorRoleId, now, now);
    console.log('  ✅ Alexander Burns created');
  }

  // Also update the existing admin user to have SUPER_ADMIN role if it exists
  const adminExists = db.prepare("SELECT id FROM User WHERE (userId = 'admin' OR username = 'admin') AND userId != 'superadmin'").get();
  if (adminExists) {
    db.prepare(`
      UPDATE User SET 
        role = 'SUPER_ADMIN',
        isActive = 1,
        permissionsRoleId = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(adminRoleId, now, adminExists.id);
    console.log('  ✅ Existing admin user updated to SUPER_ADMIN role');
  }

  // Verify final state
  const finalUsers = db.prepare('SELECT userId, username, role, isActive, email FROM User').all();
  console.log(`\n  Final users in database:`);
  finalUsers.forEach(u => console.log(`    - ${u.userId} (${u.username}) [${u.role}] active:${u.isActive} email:${u.email}`));

  db.close();
}

// Process both databases
const databases = [
  path.join(__dirname, '../prisma/dev.db'),
  path.join(__dirname, '../../dfp-neo-platform/prisma/dev.db'),
];

databases.forEach(dbPath => {
  createUsers(dbPath);
});

console.log('\n✅ User creation complete!');
console.log('\nCredentials:');
console.log('  SuperAdmin: userId=superadmin, password=Bathurst063371526');
console.log('  Alexander Burns: userId=alexander.burns, password=Burns8201112');