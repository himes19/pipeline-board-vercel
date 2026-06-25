const { getSession, handleCors } = require('../../lib/auth');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  res.status(200).json({ files: [], _note: 'File storage not yet configured.' });
};
