// pages/api/db.js
// Server-side DB proxy — dùng service_role key, không lộ ra browser

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseCall(method, table, body, query) {
  const url = `${SB_URL}/rest/v1/${table}${query || ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SB_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }
  if (!SB_URL) {
    return res.status(500).json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' });
  }

  const payload = req.body;
  if (!payload || !payload.table) {
    return res.status(400).json({ error: 'table is required' });
  }

  const ALLOWED = ['projects', 'daily_logs', 'kpi_snapshots', 'alerts'];
  if (!ALLOWED.includes(payload.table)) {
    return res.status(403).json({ error: 'Table not allowed: ' + payload.table });
  }

  try {
    const data = await supabaseCall(
      payload.method || 'GET',
      payload.table,
      payload.body || null,
      payload.query || ''
    );
    return res.status(200).json(data);
  } catch (e) {
    console.error('[/api/db error]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
