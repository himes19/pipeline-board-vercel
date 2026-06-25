const { getSession, handleCors } = require('../lib/auth');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  try {
    const { deal, type, filename, data } = req.body || {};
    if (!deal || !type || !filename || !data) { res.status(400).json({ error: 'Missing deal, type, filename, or data' }); return; }
    res.status(501).json({ error: 'File upload not yet configured. Configure BLOB_READ_WRITE_TOKEN and install @vercel/blob.' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
