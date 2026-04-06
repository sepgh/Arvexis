const API = '';

export async function apiFetch(path, opts = {}) {
  const resp = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}
