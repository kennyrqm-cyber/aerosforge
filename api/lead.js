export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
  const pathway = String(body.pathway || 'general').trim().slice(0, 80);
  const source = String(body.source || 'aerosforge-one').trim().slice(0, 80);
  const website = String(body.website || '').trim();
  const consent = body.consent === true;

  // Honeypot: silently accept bots without storing anything.
  if (website) return res.status(201).json({ ok: true, message: 'Submitted.' });

  if (!name || !email || !consent) {
    return res.status(400).json({ ok: false, error: 'Name, email, and consent are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
  }

  const leadId = `af_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const lead = {
    leadId,
    name,
    email,
    pathway,
    source,
    createdAt: new Date().toISOString()
  };

  // Launch-stage sink: captured in Vercel function logs. Before paid scale,
  // replace this with the configured CRM/database integration.
  console.log('AEROSFORGE_LEAD', JSON.stringify(lead));

  return res.status(201).json({
    ok: true,
    leadId,
    message: 'You are on the AEROSFORGE priority list.'
  });
}
