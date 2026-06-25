const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'pulsevolt-pipeline-board-secret-2026';
const USERS = {
  'jorge':     { password: 'pv2026jh', name: 'Jorge H',             role: 'admin',    seller: null },
  'horacio':   { password: 'pv2026hg', name: 'Horacio Garcia',      role: 'admin',    seller: null },
  'alejandro': { password: 'pv2026al', name: 'Alejandro',           role: 'admin',    seller: null },
  'mauricio':  { password: 'pv2026ml', name: 'MAURICIO LIRA MORIN', role: 'gerente',  seller: null },
  'alberto':   { password: 'pv2026ar', name: 'Alberto Rivera',      role: 'vendedor', seller: 'Alberto Rivera' },
  'carlos':    { password: 'pv2026cc', name: 'Carlos Cruz',         role: 'vendedor', seller: 'Carlos Cruz' },
};
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}
function getSession(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const payload = verifyToken(token);
    if (payload) return payload;
  }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    const payload = verifyToken(tokenParam);
    if (payload) return payload;
  }
  return null;
}
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
module.exports = { USERS, signToken, verifyToken, getSession, handleCors, JWT_SECRET };
