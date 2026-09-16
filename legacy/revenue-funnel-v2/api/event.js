export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const event = String(body.event || '').trim().replace(/[^a-zA-Z0-9_:-]/g, '').slice(0, 80);
  const source = String(body.source || 'web').trim().slice(0, 80);
  const detail = String(body.detail || '').trim().slice(0, 120);

  if (!event) return res.status(400).json({ ok: false, error: 'Event is required.' });

  console.log('AEROSFORGE_EVENT', JSON.stringify({
    event,
    source,
    detail,
    createdAt: new Date().toISOString()
  }));

  return res.status(202).json({ ok: true });
}
