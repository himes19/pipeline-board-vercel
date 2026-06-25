const { USERS, signToken, handleCors } = require('../lib/auth');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  try {
    const { username, password } = req.body || {};
    const user = USERS[username];
    if (!user || user.password !== password) { res.status(401).json({ error: 'Usuario o contraseña incorrectos' }); return; }
    const payload = { username, name: user.name, role: user.role, seller: user.seller };
    const token = signToken(payload);
    res.status(200).json({ token, name: user.name, role: user.role, seller: user.seller });
  } catch (e) { res.status(400).json({ error: 'Invalid request' }); }
};
