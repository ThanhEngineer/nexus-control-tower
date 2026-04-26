// pages/api/db.js
// Server-side proxy cho tất cả DB operations
// Dùng service_role key — không bao giờ lộ ra browser
// Browser chỉ gọi /api/db, không gọi Supabase trực tiếp

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabase(method, table, body, query = '') {
  const url = `${SB_URL}/rest/v1/${table}${query}`;
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
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
}

export default async function handler(req, res) {
  if (!SB_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const { method } = req;
  const { table, query, body } = req.body || {};

  if (!table) {
    return res.status(400).json({ error: 'table is required' });
  }

  // Whitelist tables — chỉ cho phép 4 tables của NEXUS
  const ALLOWED_TABLES = ['projects', 'daily_logs', 'kpi_snapshots', 'alerts'];
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(403).json({ error: 'Table not allowed' });
  }

  try {
    const data = await supabase(
      req.body.method || 'GET',
      table,
      req.body.body || null,
      req.body.query || ''
    );
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
