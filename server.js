const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const dataDir = path.join(__dirname, 'data');
const usersPath = path.join(dataDir, 'users.json');
const sessions = new Map();
const attempts = new Map();
let users = [];
let queue = Promise.resolve();
const digest = value => createHash('sha256').update(value).digest('hex');
const publicUser = user => ({ name: user.name, email: user.email });
function reply(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
function cookie(res, value, age) { res.setHeader('Set-Cookie', `folio_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${production ? '; Secure' : ''}`); }
function session(req) { const token = /(?:^|;\s*)folio_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; const record = token && sessions.get(digest(token)); return record && record.expires > Date.now() ? record : null; }
function signIn(res, user) { const token = randomBytes(32).toString('hex'); sessions.set(digest(token), { email: user.email, expires: Date.now() + 86400000 }); cookie(res, token, 86400); }
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) throw new Error('BODY_TOO_LARGE'); } return JSON.parse(raw); }
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'] };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const route = new URL(req.url, 'http://localhost').pathname;
    if (route === '/api/me' && req.method === 'GET') { const current = session(req); const user = current && users.find(u => u.email === current.email); return reply(res, 200, { user: user ? publicUser(user) : null }); }
    if (route.startsWith('/api/')) {
      if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed.' });
      const origin = req.headers.origin;
      if (!origin || origin !== (process.env.APP_ORIGIN || `http://${req.headers.host}`)) return reply(res, 403, { error: 'Request origin is not allowed.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { error: 'JSON is required.' });
      if (route === '/api/logout') { const token = /(?:^|;\s*)folio_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; if (token) sessions.delete(digest(token)); cookie(res, '', 0); return reply(res, 200, { ok: true }); }
      if (!['/api/login', '/api/register'].includes(route)) return reply(res, 404, { error: 'Not found.' });
      const ip = req.socket.remoteAddress;
      const rate = attempts.get(ip) || { count: 0, until: Date.now() + 900000 };
      if (rate.until < Date.now()) { rate.count = 0; rate.until = Date.now() + 900000; }
      attempts.set(ip, rate);
      if (++rate.count > 20) return reply(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
      const input = await body(req);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = input.password;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 12 || password.length > 128) return reply(res, 400, { error: 'Enter a valid email and a password of 12–128 characters.' });
      if (route === '/api/register') {
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        if (!name || name.length > 80) return reply(res, 400, { error: 'Enter your name (up to 80 characters).' });
        const salt = randomBytes(16).toString('hex');
        const hash = (await derive(password, salt, 64)).toString('hex');
        const task = queue.then(async () => { if (users.some(u => u.email === email)) return null; const user = { name, email, salt, hash }; const next = [...users, user]; await fs.writeFile(usersPath + '.tmp', JSON.stringify(next), { mode: 0o600 }); await fs.rename(usersPath + '.tmp', usersPath); users = next; return user; });
        queue = task.catch(() => {});
        const user = await task;
        if (!user) return reply(res, 409, { error: 'Unable to create this account. Try logging in instead.' });
        signIn(res, user); return reply(res, 201, { user: publicUser(user) });
      }
      const user = users.find(u => u.email === email);
      const hash = await derive(password, user?.salt || '00000000000000000000000000000000', 64);
      if (!user || !timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) return reply(res, 401, { error: 'Email or password is incorrect.' });
      signIn(res, user); return reply(res, 200, { user: publicUser(user) });
    }
    if (!files[route] || req.method !== 'GET') return reply(res, 404, { error: 'Not found.' });
    const [file, type] = files[route]; const content = await fs.readFile(path.join(__dirname, file));
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(content);
  } catch (error) { reply(res, error instanceof SyntaxError ? 400 : error.message === 'BODY_TOO_LARGE' ? 413 : 500, { error: error instanceof SyntaxError ? 'Invalid request.' : error.message === 'BODY_TOO_LARGE' ? 'Request is too large.' : 'Something went wrong. Please try again.' }); }
});
setInterval(() => { const now = Date.now(); for (const [key, value] of sessions) if (value.expires <= now) sessions.delete(key); for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key); }, 60000).unref();
(async () => { await fs.mkdir(dataDir, { recursive: true }); try { users = JSON.parse(await fs.readFile(usersPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; } server.listen(port, '127.0.0.1', () => console.log(`Folio is ready at http://localhost:${port}`)); })().catch(error => { console.error('Could not start Folio:', error.message); process.exitCode = 1; });
