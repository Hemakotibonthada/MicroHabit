require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
app.get('/health', async (_req, res) => {
  try {
    await db.health();
    res.json({ ok: true, database: process.env.DATABASE_URL ? 'postgres' : 'file' });
  } catch {
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});
app.use('/api', (_req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    db.flush().then(() => sendJson(body)).catch(() => {
      if (!res.headersSent) sendJson.call(res.status(503), { error: 'Database write failed' });
    });
    return res;
  };
  next();
});
app.use('/api', routes);
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html')));

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

db.init().then(() => {
  app.listen(PORT, () => console.log(`MicroHabit listening on port ${PORT}`));
}).catch((error) => {
  console.error('MicroHabit database initialization failed:', error.message);
  process.exit(1);
});
