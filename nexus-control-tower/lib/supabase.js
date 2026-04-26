// lib/supabase.js
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function sb(method, table, body = null, query = '') {
  const url = `${SB_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export const sbGet   = (table, q = '') => sb('GET',   table, null, q);
export const sbPost  = (table, b)      => sb('POST',  table, b);
export const sbPatch = (table, b, q)   => sb('PATCH', table, b, q);
export const sbDel   = (table, q)      => sb('DELETE',table, null, q);
