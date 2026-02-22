const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'microhabit_secret_key';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.userId = jwt.verify(header.split(' ')[1], JWT_SECRET).userId;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { authMiddleware, generateToken };
