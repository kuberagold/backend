/*
 * KuberaGold API security checks.
 *
 * Run against a RUNNING development backend:   npm run security:check
 * Optional: SECURITY_BASE=http://localhost:5000 npm run security:check
 *
 * Uses the development demo accounts, so it is meant for development/staging only.
 * The rate-limit checks run last: afterwards, logins from this machine are blocked for
 * 15 minutes and enquiries for an hour (restart the backend to reset them).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const BASE = process.env.SECURITY_BASE || 'http://localhost:5000';
const OLD_PUBLIC_SECRET = 'kuberagold_super_secret_jwt_key_2026_change_in_production';
const DEMO = {
  superadmin: ['superadmin@kuberagold.com', 'Admin@123456'],
  admin: ['admin@kuberagold.com', 'Admin@123456'],
  guest: ['guest@kuberagold.com', 'Guest@123456'],
};

const results = [];
const record = (id, area, name, pass, detail = '') => {
  results.push({ id, area, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(5)} ${name}${detail ? `  (${detail})` : ''}`);
};

const req = async (method, url, { token, body, headers = {}, raw } = {}) => {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
    h['Content-Type'] = h['Content-Type'] || 'application/json';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    h['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${url}`, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, json, text };
};

const login = async ([email, password]) => {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  return r.json?.data || null;
};

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const leaksInternals = (text) => /at \w+ \(|node_modules|\.js:\d+|MongoServerError|Cast to ObjectId/i.test(text || '');

async function main() {
  console.log(`\nKuberaGold security checks against ${BASE}\n`);
  const health = await req('GET', '/api/health').catch(() => null);
  if (!health) {
    console.error('Backend is not reachable. Start it first (npm run dev).');
    process.exit(2);
  }

  // ---------- A. Transport & headers ----------
  const h = health.headers;
  record('A1', 'Headers', 'X-Powered-By header removed', !h.get('x-powered-by'));
  record('A2', 'Headers', 'X-Content-Type-Options: nosniff', h.get('x-content-type-options') === 'nosniff');
  record('A3', 'Headers', 'Clickjacking protection (frame-ancestors / X-Frame-Options)',
    /frame-ancestors 'none'/.test(h.get('content-security-policy') || '') || !!h.get('x-frame-options'));
  record('A4', 'Headers', 'Strict-Transport-Security set', !!h.get('strict-transport-security'));
  record('A5', 'Headers', 'Referrer-Policy set', !!h.get('referrer-policy'));
  record('A6', 'Info leak', 'Health check reveals no versions or secrets',
    !/version|secret|mongo|uri|password/i.test(health.text), health.text.slice(0, 80));

  // ---------- B. CORS ----------
  const evil = await req('GET', '/api/branches', { headers: { Origin: 'https://evil.example' } });
  record('B1', 'CORS', 'Unknown website origin is not allowed', !evil.headers.get('access-control-allow-origin'));
  const allowedOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const good = await req('GET', '/api/branches', { headers: { Origin: allowedOrigin } });
  record('B2', 'CORS', `Own website origin (${allowedOrigin}) is allowed`, good.headers.get('access-control-allow-origin') === allowedOrigin);

  // ---------- C. Authentication ----------
  const sa = await login(DEMO.superadmin);
  const ad = await login(DEMO.admin);
  const gu = await login(DEMO.guest);
  if (!sa || !ad || !gu) {
    console.error('\nDemo logins failed. These checks need the development demo accounts (or a seeded database).');
    process.exit(2);
  }

  const forgedOld = jwt.sign({ id: sa._id }, OLD_PUBLIC_SECRET, { expiresIn: '1h' });
  const r1 = await req('GET', '/api/users', { token: forgedOld });
  record('C1', 'Auth', 'Token forged with the old published secret is rejected', r1.status === 401, `HTTP ${r1.status}`);

  const noneToken = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ id: sa._id })}.`;
  const r2 = await req('GET', '/api/users', { token: noneToken });
  record('C2', 'Auth', 'Unsigned "alg: none" token is rejected', r2.status === 401, `HTTP ${r2.status}`);

  const forgedRandom = jwt.sign({ id: sa._id }, crypto.randomBytes(32).toString('hex'));
  const r3 = await req('GET', '/api/users', { token: forgedRandom });
  record('C3', 'Auth', 'Token signed with a wrong secret is rejected', r3.status === 401, `HTTP ${r3.status}`);

  const r4 = await req('GET', '/api/users', { token: forgedOld });
  record('C4', 'Info leak', 'Auth errors do not reveal JWT library details', !/signature|jwt|malformed/i.test(r4.text));

  const r5 = await req('POST', '/api/auth/login', { body: { email: DEMO.admin[0], password: 'wrong-password-1' } });
  const r6 = await req('POST', '/api/auth/login', { body: { email: 'nobody-here@example.com', password: 'wrong-password-1' } });
  record('C5', 'Auth', 'Same error for wrong password and unknown email (no account discovery)',
    r5.status === 401 && r6.status === 401 && r5.json?.message === r6.json?.message);

  const me = await req('GET', '/api/auth/me', { token: sa.token });
  record('C6', 'Data exposure', '/auth/me returns no password or hash', me.status === 200 && !/password|passwordHash|\$2[aby]\$/i.test(me.text));

  // ---------- D. Authorisation (roles) ----------
  const adminOnly = [
    ['GET', '/api/inquiries'], ['GET', '/api/blogs/admin/all'], ['GET', '/api/banners/admin/all'],
    ['GET', '/api/branches/admin/all'], ['POST', '/api/branches'], ['POST', '/api/gold-rates/daily-update'],
  ];
  let anonOk = true; let guestOk = true; const anonBad = []; const guestBad = [];
  for (const [m, u] of adminOnly) {
    const a = await req(m, u, { body: m === 'POST' ? {} : undefined });
    if (a.status !== 401 && a.status !== 404) { anonOk = false; anonBad.push(`${m} ${u}=${a.status}`); }
    const g = await req(m, u, { token: gu.token, body: m === 'POST' ? {} : undefined });
    if (g.status !== 403 && g.status !== 404) { guestOk = false; guestBad.push(`${m} ${u}=${g.status}`); }
  }
  record('D1', 'Access control', 'Admin endpoints refuse anonymous requests (401)', anonOk, anonBad.join(', '));
  record('D2', 'Access control', 'Admin endpoints refuse guest accounts (403)', guestOk, guestBad.join(', '));

  const s1 = await req('GET', '/api/users', { token: ad.token });
  const s2 = await req('PUT', '/api/settings', { token: ad.token, body: { siteName: 'hacked' } });
  record('D3', 'Access control', 'Admins cannot reach superadmin-only user list or settings', s1.status === 403 && s2.status === 403, `users ${s1.status}, settings ${s2.status}`);

  const users = await req('GET', '/api/users', { token: sa.token });
  record('D4', 'Data exposure', 'User list contains no passwords or hashes', users.status === 200 && !/"password|passwordHash|\$2[aby]\$/i.test(users.text));

  const selfDel = await req('DELETE', `/api/users/${sa._id}`, { token: sa.token });
  const selfDeact = await req('PUT', `/api/users/${sa._id}/toggle-status`, { token: sa.token });
  const selfDemote = await req('PUT', `/api/users/${sa._id}/role`, { token: sa.token, body: { role: 'guest' } });
  record('D5', 'Access control', 'Superadmin cannot delete, deactivate or demote their own account',
    selfDel.status === 400 && selfDeact.status === 400 && selfDemote.status === 400, `${selfDel.status}/${selfDeact.status}/${selfDemote.status}`);

  const badRole = await req('PUT', `/api/users/${gu._id}/role`, { token: sa.token, body: { role: 'god' } });
  record('D6', 'Validation', 'Unknown role names are rejected', badRole.status === 400, `HTTP ${badRole.status}`);

  // ---------- E. Invite-only registration ----------
  const KEY = process.env.REGISTRATION_SECRET;
  const expectedRole = ['admin', 'guest'].includes(process.env.REGISTRATION_ROLE) ? process.env.REGISTRATION_ROLE : 'admin';
  const person = (tag) => ({ name: 'Sec Test', email: `sec-${tag}-${Date.now()}@example.com`, password: 'Str0ngPass99' });

  const noKey = await req('POST', '/api/auth/register', { body: person('nokey') });
  record('E1', 'Access control', 'Sign-up without the registration key is refused (403)', noKey.status === 403, `HTTP ${noKey.status}`);
  const wrongKey = await req('POST', '/api/auth/register', { body: { ...person('wrong'), registrationKey: 'KG-WRONG-WRONG-WRONG' } });
  record('E2', 'Access control', 'Sign-up with a wrong key is refused (403)', wrongKey.status === 403, `HTTP ${wrongKey.status}`);
  const opKey = await req('POST', '/api/auth/register', { body: { ...person('op'), registrationKey: { $ne: '' } } });
  record('E3', 'NoSQL injection', 'Key given as an operator object is refused', opKey.status === 403, `HTTP ${opKey.status}`);
  if (KEY) {
    const weak = await req('POST', '/api/auth/register', { body: { ...person('weak'), password: '123456', registrationKey: KEY } });
    record('E4', 'Validation', 'Weak passwords are rejected at sign-up', weak.status === 400, `HTTP ${weak.status}`);
    const reg = await req('POST', '/api/auth/register', { body: { ...person('ok'), role: 'superadmin', registrationKey: KEY } });
    record('E5', 'Access control', `Valid key creates a "${expectedRole}" account; asking for superadmin is ignored`,
      reg.status === 201 && reg.json?.data?.role === expectedRole, `role=${reg.json?.data?.role}`);
    if (reg.json?.data?._id) await req('DELETE', `/api/users/${reg.json.data._id}`, { token: sa.token });
  } else {
    record('E4', 'Configuration', 'REGISTRATION_SECRET not set: registration closed', noKey.json?.message === 'Registration is closed.');
  }

  // ---------- F. Injection ----------
  const inj1 = await req('POST', '/api/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
  record('F1', 'NoSQL injection', 'Login with {"$ne": null} operators is refused', inj1.status === 400 || inj1.status === 401, `HTTP ${inj1.status}`);
  const inj2 = await req('POST', '/api/auth/login', { body: { email: DEMO.admin[0], password: { $gt: '' } } });
  record('F2', 'NoSQL injection', 'Password given as an operator object is refused', inj2.status === 400 || inj2.status === 401, `HTTP ${inj2.status}`);
  const inj3 = await req('GET', '/api/inquiries/available-slots?date[$gt]=2000-01-01');
  record('F3', 'NoSQL injection', 'Query-string operators (date[$gt]) are not treated as operators', inj3.status === 400, `HTTP ${inj3.status}`);
  const inj4 = await req('GET', '/api/inquiries/available-slots?date=2030-01-01&branch[$ne]=x');
  record('F4', 'NoSQL injection', 'branch[$ne] is ignored, not used as a filter', inj4.status === 200 && inj4.json?.data?.branch === 'All Branches');
  const proto = await req('POST', '/api/auth/login', { raw: '{"__proto__":{"isAdmin":true},"email":"a@b.co","password":"x1234567"}' });
  record('F5', 'Prototype pollution', '__proto__ keys in JSON are stripped', proto.status === 401, `HTTP ${proto.status}`);

  // ---------- G. Input validation (public forms) ----------
  const base = { customerName: 'SECURITY TEST', phone: '9800000000', inquiryType: 'general', message: 'automated security check' };
  const v1 = await req('POST', '/api/inquiries', { body: { ...base, phone: 'not-a-phone' } });
  record('G1', 'Validation', 'Enquiry with an invalid phone number is rejected', v1.status === 400, `HTTP ${v1.status}`);
  const v2 = await req('POST', '/api/inquiries', { body: { ...base, phone: { a: 1 } } });
  record('G2', 'Validation', 'Wrong data types return 400, not a server crash', v2.status === 400, `HTTP ${v2.status}`);
  const v3 = await req('POST', '/api/inquiries', { body: { ...base, inquiryType: 'valuation_appointment', appointmentDate: '2099-01-01', appointmentTimeSlot: '3 AM' } });
  record('G3', 'Validation', 'Appointment time slot must be one of the listed slots', v3.status === 400, `HTTP ${v3.status}`);
  const v4 = await req('POST', '/api/inquiries', { body: { ...base, message: 'x'.repeat(10000) } });
  record('G4', 'Validation', 'Very long messages are cut to 2,000 characters', v4.status === 201 && v4.json?.data?.message?.length === 2000, `stored ${v4.json?.data?.message?.length}`);
  const created = v4.json?.data;

  if (created?._id) {
    const ma = await req('PUT', `/api/inquiries/${created._id}`, { token: ad.token, body: { status: 'contacted', customerName: 'Changed', phone: '0000000' } });
    record('G5', 'Mass assignment', 'Staff status update cannot rewrite the customer\'s details',
      ma.status === 200 && ma.json?.data?.customerName === 'SECURITY TEST' && ma.json?.data?.status === 'contacted');
    const badStatus = await req('PUT', `/api/inquiries/${created._id}`, { token: ad.token, body: { status: 'hacked' } });
    record('G6', 'Validation', 'Unknown enquiry status is rejected', badStatus.status === 400, `HTTP ${badStatus.status}`);
    await req('DELETE', `/api/inquiries/${created._id}`, { token: ad.token });
  }

  const bjs = await req('POST', '/api/banners', { token: ad.token, body: { title: 'x', imageUrl: '/a.png', ctaLink: 'javascript:alert(1)' } });
  record('G7', 'Stored XSS', 'Banner links using javascript: are rejected', bjs.status === 400, `HTTP ${bjs.status}`);
  const br = await req('POST', '/api/branches', { token: ad.token, body: { name: 'SEC TEST', city: 'X', address: 'Y', mapUrl: 'javascript:alert(1)', isActive: false } });
  record('G8', 'Stored XSS', 'Branch map links using javascript: are blanked', br.status === 201 && br.json?.data?.mapUrl === '', `mapUrl="${br.json?.data?.mapUrl}"`);
  if (br.json?.data?.id) await req('DELETE', `/api/branches/${br.json.data.id}`, { token: ad.token });
  const soc = await req('PUT', '/api/settings', { token: sa.token, body: { socialLinks: { facebook: 'javascript:alert(1)' } } });
  record('G9', 'Stored XSS', 'Social links using javascript: are blanked', soc.status === 200 && soc.json?.data?.socialLinks?.facebook === '');

  // ---------- H. Error handling ----------
  const bad = await req('POST', '/api/auth/login', { raw: '{"email": "a@b.co", "password": ' });
  record('H1', 'Error handling', 'Malformed JSON gets a clean 400 with no stack trace', bad.status === 400 && !leaksInternals(bad.text), `HTTP ${bad.status}`);
  const big = await req('POST', '/api/inquiries', { body: { ...base, message: 'x'.repeat(300 * 1024) } });
  record('H2', 'DoS', 'Request bodies over 200 KB are refused (413)', big.status === 413, `HTTP ${big.status}`);
  const nf = await req('GET', '/api/does-not-exist/<script>');
  record('H3', 'Error handling', 'Unknown routes return 404 without echoing the URL', nf.status === 404 && !nf.text.includes('<script>'));
  const badId = await req('PUT', '/api/banners/not-an-id', { token: ad.token, body: { title: 'x' } });
  record('H4', 'Error handling', 'Bad record IDs return 4xx without internal details', badId.status >= 400 && badId.status < 500 && !leaksInternals(badId.text), `HTTP ${badId.status}`);

  // ---------- I. Rate limiting (runs last) ----------
  const rl = await req('GET', '/api/branches');
  record('I1', 'Rate limiting', 'Rate-limit headers are sent on API responses', !!(rl.headers.get('ratelimit') || rl.headers.get('ratelimit-policy')));

  let loginBlockedAt = null;
  for (let i = 1; i <= 12; i++) {
    const r = await req('POST', '/api/auth/login', { body: { email: DEMO.admin[0], password: `wrong-${i}-pass` } });
    if (r.status === 429) { loginBlockedAt = i; break; }
  }
  record('I2', 'Rate limiting', 'Password guessing is blocked after 10 failed logins', loginBlockedAt !== null && loginBlockedAt <= 11, `blocked at attempt ${loginBlockedAt}`);

  let inquiryBlockedAt = null;
  const made = [];
  for (let i = 1; i <= 12; i++) {
    const r = await req('POST', '/api/inquiries', { body: { ...base, message: `rate test ${i}` } });
    if (r.status === 429) { inquiryBlockedAt = i; break; }
    if (r.json?.data?._id) made.push(r.json.data._id);
  }
  record('I3', 'Rate limiting', 'Enquiry spam is blocked after 10 per hour', inquiryBlockedAt !== null && inquiryBlockedAt <= 11, `blocked at request ${inquiryBlockedAt}`);
  for (const id of made) await req('DELETE', `/api/inquiries/${id}`, { token: ad.token });

  let calcBlockedAt = null;
  for (let i = 1; i <= 65; i++) {
    const r = await req('POST', '/api/gold-rates/calculate', { body: { metal: 'gold', carat: '22K', weightInGrams: 1 } });
    if (r.status === 429) { calcBlockedAt = i; break; }
  }
  record('I4', 'Rate limiting', 'Calculator is limited to 60 requests a minute', calcBlockedAt !== null && calcBlockedAt <= 61, `blocked at request ${calcBlockedAt}`);

  // ---------- J. Production safety (separate short-lived servers) ----------
  const bootProd = (env, port) => new Promise((resolve) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production', PORT: String(port), CLIENT_URL: 'https://kubera.example', MONGO_URI: 'mongodb://127.0.0.1:1/none', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const done = (r) => { try { child.kill(); } catch { /* already gone */ } resolve(r); };
    child.on('exit', (code) => done({ exited: true, code, out }));
    setTimeout(async () => {
      try {
        const a = await fetch(`http://localhost:${port}/api/branches`);
        const b = await fetch(`http://localhost:${port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: DEMO.superadmin[0], password: DEMO.superadmin[1] }) });
        done({ exited: false, branches: a.status, login: b.status, out });
      } catch (e) {
        done({ exited: false, error: e.message, out });
      }
    }, 2500);
  });

  const weakProd = await bootProd({ JWT_SECRET: OLD_PUBLIC_SECRET }, 5091);
  record('J1', 'Configuration', 'Production refuses to start with the published JWT secret', weakProd.exited && weakProd.code !== 0, weakProd.exited ? `exit ${weakProd.code}` : 'kept running');

  const noDbProd = await bootProd({ JWT_SECRET: crypto.randomBytes(48).toString('hex') }, 5092);
  record('J2', 'Data storage', 'Production without a database answers 503 (no silent memory mode)', noDbProd.branches === 503, `branches ${noDbProd.branches}`);
  record('J3', 'Access control', 'Demo accounts cannot log in on production', noDbProd.login === 503 || noDbProd.login === 401, `login ${noDbProd.login}`);

  // ---------- Summary ----------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach((f) => console.log(`  ${f.id} ${f.name} ${f.detail}`));
  }
  console.log('\nNote: logins from this machine are now rate-limited for 15 minutes (restart the backend to reset).\n');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('Security check crashed:', e);
  process.exit(2);
});
