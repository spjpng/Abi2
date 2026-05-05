const rateLimitMap = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ODDS_API_KEY) {
    return res.status(500).json({ error: 'ODDS_API_KEY not configured' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = 10;

  const calls = (rateLimitMap.get(ip) || []).filter(t => now - t < windowMs);
  if (calls.length >= limit) {
    return res.status(429).json({ error: 'RATE LIMIT EXCEEDED' });
  }
  calls.push(now);
  if (calls.length > 0) {
    rateLimitMap.set(ip, calls);
  } else {
    rateLimitMap.delete(ip);
  }

  const { markets, eventId } = req.query;

  if (eventId && !/^[a-f0-9]{1,64}$/i.test(eventId)) {
    return res.status(400).json({ error: 'Invalid eventId format' });
  }

  const base = eventId
    ? `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds`
    : `https://api.the-odds-api.com/v4/sports/basketball_nba/odds`;

  const params = new URLSearchParams({
    apiKey: process.env.ODDS_API_KEY,
    regions: 'us',
    markets: markets || 'h2h,spreads,totals',
    oddsFormat: 'american'
  });

  try {
    const upstreamRes = await fetch(`${base}?${params}`);
    const data = await upstreamRes.json();
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json(data);
    }
    res.setHeader('Cache-Control', 's-maxage=300');
    res.json(data);
  } catch(e) {
    res.status(502).json({ error: 'Failed to reach odds provider' });
  }
}
