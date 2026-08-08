export const config = { maxDuration: 15 };

// Simple in-memory cache for the Tor exit node list -- reused across
// warm serverless invocations so we don't refetch a multi-KB list on
// every single request.
let torListCache = { list: null, fetchedAt: 0 };
const TOR_LIST_TTL = 30 * 60 * 1000; // 30 minutes

async function getTorExitList() {
  const now = Date.now();
  if (torListCache.list && now - torListCache.fetchedAt < TOR_LIST_TTL) {
    return torListCache.list;
  }
  try {
    const res = await fetch('https://check.torproject.org/torbulkexitlist');
    if (!res.ok) throw new Error('Tor list fetch failed');
    const text = await res.text();
    const list = new Set(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    );
    torListCache = { list, fetchedAt: now };
    return list;
  } catch (e) {
    // If the Tor list is unreachable, don't fail the whole request --
    // just report "unknown" for the Tor check.
    return null;
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket && req.socket.remoteAddress;
}

async function getGeoInfo(ip) {
  const res = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,zip,isp,org,as,query`
  );
  if (!res.ok) throw new Error('Geo lookup failed');
  const data = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'Geo lookup failed for this IP.');
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow checking either the visitor's own IP or a custom IP passed
  // as a query param (?ip=1.2.3.4), so the tool can double as a
  // general "what is this IP" lookup.
  const queryIp = typeof req.query.ip === 'string' && req.query.ip.trim() ? req.query.ip.trim() : null;
  const targetIp = queryIp || getClientIp(req);

  if (!targetIp) {
    return res.status(400).json({ error: 'Could not determine an IP address to look up.' });
  }

  try {
    const [geo, torList] = await Promise.all([getGeoInfo(targetIp), getTorExitList()]);

    const isTor = torList ? torList.has(targetIp) : null;

    return res.status(200).json({
      success: true,
      ip: targetIp,
      country: geo.country,
      region: geo.regionName,
      city: geo.city,
      zip: geo.zip,
      isp: geo.isp,
      org: geo.org,
      asn: geo.as,
      isTorExitNode: isTor
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message || 'IP lookup failed. Please try again.' });
  }
}
