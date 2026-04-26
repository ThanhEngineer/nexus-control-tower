// lib/supabase.js
// Tất cả DB calls đi qua /api/db (server-side, service_role key)
// Browser không bao giờ gọi Supabase trực tiếp — anon key không còn cần thiết

async function dbProxy(method, table, body = null, query = '') {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, table, body, query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'DB error');
  return data;
}

export const sbGet   = (table, q = '') => dbProxy('GET',    table, null, q);
export const sbPost  = (table, b)      => dbProxy('POST',   table, b);
export const sbPatch = (table, b, q)   => dbProxy('PATCH',  table, b, q);
export const sbDel   = (table, q)      => dbProxy('DELETE', table, null, q);
