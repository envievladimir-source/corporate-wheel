const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// Когда собрано через pkg в отдельный бинарник, __dirname указывает внутрь
// виртуальной "снапшот"-файловой системы. Реальные, редактируемые файлы
// (.env, public/, data/) должны лежать рядом с самим бинарником на диске.
const isPkg = typeof process.pkg !== 'undefined';
const BASE_DIR = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

require('dotenv').config({ path: path.join(BASE_DIR, '.env') });

const db = require('./db');

const app = express();

const PORT = process.env.PORT || 3000;
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'change-me-in-production';
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'company.com')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
const COUNTRIES = (process.env.COUNTRIES || 'Україна,Польща,Кіпр')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean)
  .concat(['Інша']);
const ENABLE_IP_LOCK = String(process.env.ENABLE_IP_LOCK || 'true').toLowerCase() === 'true';
const COOKIE_NAME = 'cw_session';

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static(path.join(BASE_DIR, 'public')));

app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .toString()
    .split(',')[0]
    .trim();
}

function emailDomainAllowed(email) {
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return false;
  return ALLOWED_DOMAINS.includes(parts[1]);
}

function findEntryByToken(token) {
  return db.findByToken(token);
}

const FUN_FACTS = (process.env.FUN_FACTS || '')
  .split('|')
  .map((f) => f.trim())
  .filter(Boolean);

app.get('/api/config', (req, res) => {
  res.json({
    companyName: process.env.COMPANY_NAME || 'Evoplay',
    anniversaryYears: process.env.ANNIVERSARY_YEARS || '10',
    superPrizeTitle: process.env.SUPER_PRIZE_TITLE || 'ДЖЕКПОТ',
    countries: COUNTRIES,
    allowedDomainsHint: ALLOWED_DOMAINS.map((d) => `@${d}`).join(', '),
    facts: FUN_FACTS,
  });
});

app.get('/api/me', (req, res) => {
  const entry = findEntryByToken(req.signedCookies[COOKIE_NAME]);
  if (!entry) return res.json({ registered: false });
  res.json({
    registered: true,
    email: entry.email,
    country: entry.country,
    spun: Boolean(entry.spun_at),
    prize: entry.prize || null,
  });
});

app.post('/api/register', (req, res) => {
  const { email, country } = req.body || {};

  if (typeof email !== 'string' || typeof country !== 'string') {
    return res.status(400).json({ error: 'invalid_input', message: 'Заповни всі поля.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ error: 'invalid_email', message: 'Некоректний email.' });
  }

  if (!emailDomainAllowed(normalizedEmail)) {
    return res.status(400).json({
      error: 'domain_not_allowed',
      message: `Реєстрація доступна лише з корпоративної пошти (${ALLOWED_DOMAINS
        .map((d) => '@' + d)
        .join(', ')}).`,
    });
  }

  if (!COUNTRIES.includes(country)) {
    return res.status(400).json({ error: 'invalid_country', message: 'Обери країну зі списку.' });
  }

  // Уже есть активная сессия — просто вернём её состояние вместо повторной регистрации
  const existingByCookie = findEntryByToken(req.signedCookies[COOKIE_NAME]);
  if (existingByCookie) {
    return res.status(409).json({
      error: 'already_registered',
      message: 'Ти вже береш участь в акції.',
      spun: Boolean(existingByCookie.spun_at),
    });
  }

  const existingByEmail = db.findByEmail(normalizedEmail);
  if (existingByEmail) {
    return res.status(409).json({
      error: 'email_already_used',
      message: 'Упс, з цієї пошти вже брали участь в акції.',
    });
  }

  const ip = getClientIp(req);
  if (ENABLE_IP_LOCK) {
    const existingByIp = db.findByIp(ip);
    if (existingByIp) {
      return res.status(409).json({
        error: 'ip_already_used',
        message: 'Упс, з цього пристрою/мережі вже брали участь в акції.',
      });
    }
  }

  const token = crypto.randomBytes(24).toString('hex');

  db.insert({ token, email: normalizedEmail, country, ip });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });

  res.json({ ok: true, email: normalizedEmail, country });
});

app.post('/api/spin', (req, res) => {
  const entry = findEntryByToken(req.signedCookies[COOKIE_NAME]);

  if (!entry) {
    return res.status(401).json({ error: 'not_registered', message: 'Спочатку пройди реєстрацію.' });
  }

  if (entry.spun_at) {
    return res.status(409).json({
      error: 'already_spun',
      message: 'Упс, ти вже крутив колесо.',
      prize: entry.prize,
    });
  }

  const prize = process.env.SUPER_PRIZE_TITLE || 'ДЖЕКПОТ';

  db.markSpun(entry.id, prize);

  res.json({
    ok: true,
    prize,
    description:
      process.env.SUPER_PRIZE_DESCRIPTION ||
      'Сьогодні виграють усі — бо 10 років Evoplay це і є наш спільний джекпот. Деталі призу шукай у HR!',
  });
});

// Только для локальной разработки/демо: сбрасывает cookie текущего браузера,
// чтобы можно было повторно проверить сценарий регистрации. Удали перед продом.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/reset-session', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    db.resetAll();
    res.json({ ok: true });
  });
}

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Corporate wheel running on ${url}`);

  // Автоматически открываем браузер — удобно для запуска двойным кликом
  // по собранному бинарнику (демонстрация без установки Node.js).
  if (isPkg) {
    const openCmd =
      process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
    exec(`${openCmd} ${url}`);
  }
});
