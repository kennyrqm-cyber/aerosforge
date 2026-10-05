export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    service: 'aerosforge-one',
    version: 'v1-revenue-funnel',
    timestamp: new Date().toISOString()
  });
}
