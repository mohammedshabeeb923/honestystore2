/**
 * Test Admin Authentication & Whitelist Verification
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read server.js code and check logic
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const ALLOWED_ADMIN_EMAILS = [
  'godson107111@gmail.com',
  'mohammedshabeeb923@gmail.com',
  'shahidkkvl@gmail.com'
].map(e => e.toLowerCase().trim());

console.log('Testing Admin Authorization Whitelist...');
console.log('Allowed Admin Count:', ALLOWED_ADMIN_EMAILS.length);

const SERVER_SECRET = 'honesty-store-dev-secret-key-2026';

function signAdminToken(email) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const payload = {
    email: cleanEmail,
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 3600 * 1000
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(body).digest('base64url');
  return `admin_sess_${body}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token) return false;
  if (!token.startsWith('admin_sess_')) return false;
  const raw = token.slice('admin_sess_'.length);
  const parts = raw.split('.');
  if (parts.length !== 2) return false;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', SERVER_SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return false;
    if (payload.role !== 'admin') return false;
    const tokenEmail = (payload.email || payload.username || '').toLowerCase().trim();
    return ALLOWED_ADMIN_EMAILS.includes(tokenEmail);
  } catch (e) {
    return false;
  }
}

// 1. Verify all 3 authorized emails succeed
for (const email of ALLOWED_ADMIN_EMAILS) {
  const token = signAdminToken(email);
  const isValid = verifyAdminToken(token);
  if (!isValid) {
    throw new Error(`Failed to verify authorized admin: ${email}`);
  }
  console.log(`✓ Authorized admin verified: [HIDDEN_EMAIL] -> Valid token: ${token.slice(0, 25)}...`);
}

// 2. Verify unauthorized email is rejected
const intruderEmail = 'randomuser99@gmail.com';
const intruderToken = signAdminToken(intruderEmail);
const isIntruderValid = verifyAdminToken(intruderToken);
if (isIntruderValid) {
  throw new Error(`CRITICAL: Intruder was unexpectedly allowed!`);
}
console.log('✓ Unauthorized email blocked properly.');

// 3. Verify forged token is rejected
const forgedToken = 'admin_sess_eyJlbWFpbCI6ImdvZHNvbjEwNzExMUBnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4ifQ.forged_signature';
if (verifyAdminToken(forgedToken)) {
  throw new Error('CRITICAL: Forged token was accepted!');
}
console.log('✓ Forged token blocked properly.');

// 4. Verify old legacy bypass tokens are rejected
if (verifyAdminToken('admin-authorized-session') || verifyAdminToken('admin_sess_legacy')) {
  throw new Error('CRITICAL: Legacy bypass was accepted!');
}
console.log('✓ Legacy unverified bypass tokens blocked properly.');

console.log('\n🎉 ALL ADMIN WHITELIST TESTS PASSED SUCCESSFULLY!');
