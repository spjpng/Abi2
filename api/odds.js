const rateLimitMap = new Map();

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = 10;

  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const calls = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  if (calls.length >= limit) {
    return res.status(429).json({ error: 'RATE LIMIT EXCEEDED' });
  }
  calls.push(now);
  rateLimitMap.set(ip, calls);

  const { market, eventId } = req.query;
  const base = eventId
    ? `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds`
    : `https://api.the-odds-api.com/v4/sports/basketball_nba/odds`;

  const params = new URLSearchParams({
    apiKey: process.env.ODDS_API_KEY,
    regions: 'us',
    markets: market || 'h2h,spreads,totals',
    oddsFormat: 'american'
  });

  const data = await fetch(`${base}?${params}`).then(r => r.json());
  res.setHeader('Cache-Control', 's-maxage=300');
  res.json(data);
}
