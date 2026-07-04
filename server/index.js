import './loadEnv.js';
import fs from 'node:fs';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import pg from 'pg';
import { q, q1 } from './db.js';
import { postgresUrlForDDL } from './dbUrl.js';
import { resolveBundledDbPath } from './bundledDbPath.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  generateCode,
  generatePin,
} from './auth.js';

const { Pool: PgPool } = pg;

const apiDb = {
  ready: !String(process.env.DATABASE_URL ?? '').trim(),
  bootError: '',
};

const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const SUPERADMIN_EMAIL = String(process.env.SUPERADMIN_EMAIL ?? 'info@wwferic.space').trim().toLowerCase();
const SUPERADMIN_PASSWORD = String(process.env.SUPERADMIN_PASSWORD ?? '057109eric').trim();
const SUPERADMIN_NAME = String(process.env.SUPERADMIN_NAME ?? 'Super Admin').trim();

const app = express();
app.use(cors({
  origin: CORS_ORIGIN
    ? [CORS_ORIGIN, /^http:\/\/localhost(:\d+)?$/, /^https:\/\/[\w-]+\.ondigitalocean\.app$/]
    : true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));

function json(res, data, status = 200) {
  return res.status(status).json(data);
}

function defaultDbUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  return rawUrl.replace(/\/[^/?]+(\?|$)/, '/defaultdb$1');
}

async function ensureDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl || !rawUrl.includes('/gt_lms')) return;
  const adminUrl = postgresUrlForDDL(defaultDbUrl(rawUrl));
  const adminPool = new PgPool({ connectionString: adminUrl, max: 1 });
  try {
    const exists = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = 'gt_lms'`);
    if (exists.rowCount === 0) {
      await adminPool.query('CREATE DATABASE gt_lms');
      console.log('Created database gt_lms');
    }
  } finally {
    await adminPool.end();
  }
}

async function ensureSchema() {
  const schemaPath = resolveBundledDbPath('schema.sql');
  if (!schemaPath) return;
  const ddlUrl = postgresUrlForDDL(process.env.DATABASE_URL);
  const ddlPool = new PgPool({ connectionString: ddlUrl, max: 1 });
  try {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await ddlPool.query(sql);
  } finally {
    await ddlPool.end();
  }
}

async function seedSuperadmin() {
  const existing = await q1('SELECT id FROM users WHERE email = $1', [SUPERADMIN_EMAIL]);
  if (existing) return;
  if (!SUPERADMIN_PASSWORD) {
    console.warn('SUPERADMIN_PASSWORD not set; skipping superadmin seed');
    return;
  }
  const password_hash = hashPassword(SUPERADMIN_PASSWORD);
  await q1(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'superadmin') RETURNING id`,
    [SUPERADMIN_EMAIL, password_hash, SUPERADMIN_NAME],
  );
  console.log(`Seeded superadmin: ${SUPERADMIN_EMAIL}`);
}

async function bootstrapDb() {
  if (!process.env.DATABASE_URL) return;
  const delays = [0, 5000, 15000, 30000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      await ensureDatabase();
      await ensureSchema();
      await seedSuperadmin();
      apiDb.ready = true;
      apiDb.bootError = '';
      console.log('DB bootstrap complete');
      return;
    } catch (err) {
      apiDb.bootError = String(err?.message || err);
      console.error(`DB bootstrap attempt ${i + 1} failed:`, apiDb.bootError);
    }
  }
}

const api = express.Router();

api.get('/health', (req, res) => {
  json(res, { ok: true, dbReady: apiDb.ready, bootError: apiDb.bootError || undefined });
});

api.use((req, res, next) => {
  if (!apiDb.ready && process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database initializing', retryAfter: 5 });
  }
  next();
});

// ── Auth ──
api.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) return json(res, { error: 'Email and password required' }, 400);

  const user = await q1('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return json(res, { error: 'Invalid credentials' }, 401);
  }

  const token = signToken(user);
  return json(res, {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

api.get('/auth/me', requireAuth(), async (req, res) => {
  const user = await q1('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.user.sub]);
  if (!user) return json(res, { error: 'User not found' }, 404);
  return json(res, { user });
});

api.post('/auth/register', requireAuth(['superadmin', 'teacher']), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const name = String(req.body?.name ?? '').trim();
  const role = String(req.body?.role ?? 'student');
  if (!email || !password || !name) return json(res, { error: 'Missing fields' }, 400);
  if (!['teacher', 'student'].includes(role) && req.user.role !== 'superadmin') {
    return json(res, { error: 'Cannot create this role' }, 403);
  }
  if (role === 'teacher' && req.user.role !== 'superadmin') {
    return json(res, { error: 'Only superadmin can create teachers' }, 403);
  }

  const password_hash = hashPassword(password);
  try {
    const user = await q1(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email, password_hash, name, role],
    );
    return json(res, { user }, 201);
  } catch (err) {
    if (err.code === '23505') return json(res, { error: 'Email already exists' }, 409);
    throw err;
  }
});

// ── Dashboard stats ──
api.get('/stats', requireAuth(), async (req, res) => {
  const isAdmin = ['superadmin', 'teacher'].includes(req.user.role);
  if (isAdmin) {
    const [classes, activities, users] = await Promise.all([
      q('SELECT COUNT(*)::int AS count FROM classes'),
      q('SELECT COUNT(*)::int AS count FROM activities'),
      q('SELECT COUNT(*)::int AS count FROM users'),
    ]);
    return json(res, {
      classes: classes[0]?.count ?? 0,
      activities: activities[0]?.count ?? 0,
      users: users[0]?.count ?? 0,
    });
  }
  const enrolled = await q1(
    'SELECT COUNT(*)::int AS count FROM enrollments WHERE user_id = $1',
    [req.user.sub],
  );
  return json(res, { classes: enrolled?.count ?? 0, activities: 0, users: 0 });
});

// ── Classes ──
api.get('/classes', requireAuth(), async (req, res) => {
  if (['superadmin', 'teacher'].includes(req.user.role)) {
    const data = await q(
      `SELECT c.*, u.name AS teacher_name,
              (SELECT COUNT(*)::int FROM enrollments e WHERE e.class_id = c.id) AS student_count
       FROM classes c
       LEFT JOIN users u ON u.id = c.teacher_id
       ORDER BY c.created_at DESC`,
    );
    return json(res, { data });
  }
  const data = await q(
    `SELECT c.*, u.name AS teacher_name
     FROM classes c
     JOIN enrollments e ON e.class_id = c.id
     LEFT JOIN users u ON u.id = c.teacher_id
     WHERE e.user_id = $1
     ORDER BY c.created_at DESC`,
    [req.user.sub],
  );
  return json(res, { data });
});

api.post('/classes', requireAuth(['superadmin', 'teacher']), async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!name) return json(res, { error: 'Name required' }, 400);

  let code = generateCode(6);
  for (let i = 0; i < 5; i += 1) {
    const clash = await q1('SELECT id FROM classes WHERE code = $1', [code]);
    if (!clash) break;
    code = generateCode(6);
  }

  const teacherId = req.user.role === 'teacher' ? req.user.sub : (req.body?.teacher_id ?? req.user.sub);
  const data = await q1(
    `INSERT INTO classes (name, code, description, teacher_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, code, description, teacherId],
  );
  return json(res, { data }, 201);
});

api.get('/classes/:id', requireAuth(), async (req, res) => {
  const data = await q1(
    `SELECT c.*, u.name AS teacher_name
     FROM classes c
     LEFT JOIN users u ON u.id = c.teacher_id
     WHERE c.id = $1`,
    [req.params.id],
  );
  if (!data) return json(res, { error: 'Not found' }, 404);
  return json(res, { data });
});

api.post('/classes/join', requireAuth(), async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  if (!code) return json(res, { error: 'Class code required' }, 400);
  const cls = await q1('SELECT * FROM classes WHERE code = $1', [code]);
  if (!cls) return json(res, { error: 'Invalid class code' }, 404);

  await q(
    `INSERT INTO enrollments (class_id, user_id) VALUES ($1, $2)
     ON CONFLICT (class_id, user_id) DO NOTHING`,
    [cls.id, req.user.sub],
  );
  return json(res, { data: cls });
});

// ── Activities ──
api.get('/classes/:classId/activities', requireAuth(), async (req, res) => {
  const data = await q(
    'SELECT * FROM activities WHERE class_id = $1 ORDER BY created_at DESC',
    [req.params.classId],
  );
  return json(res, { data });
});

api.post('/classes/:classId/activities', requireAuth(['superadmin', 'teacher']), async (req, res) => {
  const type = String(req.body?.type ?? '');
  const title = String(req.body?.title ?? '').trim();
  if (!['wall', 'quiz', 'survey'].includes(type) || !title) {
    return json(res, { error: 'Invalid activity' }, 400);
  }
  const data = await q1(
    `INSERT INTO activities (class_id, type, title, config)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.classId, type, title, JSON.stringify(req.body?.config ?? {})],
  );
  return json(res, { data }, 201);
});

// ── Wall (Padlet-style) ──
api.get('/activities/:id/wall', requireAuth(), async (req, res) => {
  const activity = await q1('SELECT * FROM activities WHERE id = $1 AND type = $2', [req.params.id, 'wall']);
  if (!activity) return json(res, { error: 'Wall not found' }, 404);
  const posts = await q(
    `SELECT p.*, u.name AS author_name
     FROM wall_posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.activity_id = $1
     ORDER BY p.created_at DESC`,
    [req.params.id],
  );
  return json(res, { activity, posts });
});

api.post('/activities/:id/wall/posts', requireAuth(), async (req, res) => {
  const content = String(req.body?.content ?? '').trim();
  if (!content) return json(res, { error: 'Content required' }, 400);
  const activity = await q1('SELECT * FROM activities WHERE id = $1 AND type = $2', [req.params.id, 'wall']);
  if (!activity) return json(res, { error: 'Wall not found' }, 404);

  const data = await q1(
    `INSERT INTO wall_posts (activity_id, user_id, content, media_url)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.id, req.user.sub, content, req.body?.media_url ?? null],
  );
  const author = await q1('SELECT name FROM users WHERE id = $1', [req.user.sub]);
  return json(res, { data: { ...data, author_name: author?.name } }, 201);
});

// ── Quiz (Kahoot-style) ──
api.get('/activities/:id/quiz', requireAuth(), async (req, res) => {
  const activity = await q1('SELECT * FROM activities WHERE id = $1 AND type = $2', [req.params.id, 'quiz']);
  if (!activity) return json(res, { error: 'Quiz not found' }, 404);
  const questions = await q(
    'SELECT * FROM quiz_questions WHERE activity_id = $1 ORDER BY sort_order, id',
    [req.params.id],
  );
  return json(res, { activity, questions });
});

api.post('/activities/:id/quiz/questions', requireAuth(['superadmin', 'teacher']), async (req, res) => {
  const { question, options, correct_index, time_limit } = req.body || {};
  if (!question || !Array.isArray(options) || options.length < 2) {
    return json(res, { error: 'Invalid question' }, 400);
  }
  const count = await q1('SELECT COUNT(*)::int AS c FROM quiz_questions WHERE activity_id = $1', [req.params.id]);
  const data = await q1(
    `INSERT INTO quiz_questions (activity_id, question, options, correct_index, time_limit, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.params.id, question, JSON.stringify(options), correct_index ?? 0, time_limit ?? 20, count?.c ?? 0],
  );
  return json(res, { data }, 201);
});

api.post('/activities/:id/quiz/sessions', requireAuth(['superadmin', 'teacher']), async (req, res) => {
  let pin = generatePin();
  for (let i = 0; i < 5; i += 1) {
    const clash = await q1('SELECT id FROM quiz_sessions WHERE pin = $1', [pin]);
    if (!clash) break;
    pin = generatePin();
  }
  const data = await q1(
    `INSERT INTO quiz_sessions (activity_id, pin) VALUES ($1, $2) RETURNING *`,
    [req.params.id, pin],
  );
  return json(res, { data }, 201);
});

api.post('/quiz/join', requireAuth(), async (req, res) => {
  const pin = String(req.body?.pin ?? '').trim();
  const session = await q1(
    `SELECT s.*, a.title AS quiz_title, a.class_id
     FROM quiz_sessions s
     JOIN activities a ON a.id = s.activity_id
     WHERE s.pin = $1 AND s.status != 'finished'`,
    [pin],
  );
  if (!session) return json(res, { error: 'Invalid or expired PIN' }, 404);
  return json(res, { session });
});

api.get('/quiz/sessions/:id', requireAuth(), async (req, res) => {
  const session = await q1('SELECT * FROM quiz_sessions WHERE id = $1', [req.params.id]);
  if (!session) return json(res, { error: 'Not found' }, 404);
  const questions = await q(
    'SELECT id, question, options, time_limit, sort_order FROM quiz_questions WHERE activity_id = $1 ORDER BY sort_order',
    [session.activity_id],
  );
  const leaderboard = await q(
    `SELECT u.name, SUM(a.score)::int AS total_score
     FROM quiz_answers a
     JOIN users u ON u.id = a.user_id
     WHERE a.session_id = $1
     GROUP BY u.id, u.name
     ORDER BY total_score DESC
     LIMIT 20`,
    [req.params.id],
  );
  return json(res, { session, questions, leaderboard });
});

api.post('/quiz/sessions/:id/start', requireAuth(['superadmin', 'teacher']), async (req, res) => {
  const data = await q1(
    `UPDATE quiz_sessions SET status = 'active', started_at = NOW(), current_question = 0
     WHERE id = $1 RETURNING *`,
    [req.params.id],
  );
  if (!data) return json(res, { error: 'Not found' }, 404);
  return json(res, { data });
});

api.post('/quiz/sessions/:id/answer', requireAuth(), async (req, res) => {
  const { question_id, answer_index } = req.body || {};
  const session = await q1('SELECT * FROM quiz_sessions WHERE id = $1 AND status = $2', [req.params.id, 'active']);
  if (!session) return json(res, { error: 'Session not active' }, 400);

  const question = await q1('SELECT * FROM quiz_questions WHERE id = $1', [question_id]);
  if (!question) return json(res, { error: 'Question not found' }, 404);

  const correct = Number(answer_index) === Number(question.correct_index);
  const score = correct ? 1000 : 0;

  const data = await q1(
    `INSERT INTO quiz_answers (session_id, user_id, question_id, answer_index, score)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id, user_id, question_id)
     DO UPDATE SET answer_index = EXCLUDED.answer_index, score = EXCLUDED.score, answered_at = NOW()
     RETURNING *`,
    [req.params.id, req.user.sub, question_id, answer_index, score],
  );
  return json(res, { data, correct });
});

app.use('/api', api);
app.use('/', api);

app.use((err, req, res, _next) => {
  console.error(err);
  json(res, { error: err.message || 'Internal error' }, 500);
});

const port = Number(process.env.PORT) || 8081;
app.listen(port, '0.0.0.0', () => {
  console.log(`gt-lms API listening on :${port}`);
  bootstrapDb();
});
