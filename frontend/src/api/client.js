export function getToken() {
  return localStorage.getItem('token') || '';
}

export async function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!headers['Content-Type'] && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
  }
  const controller = new AbortController();
  const timeoutMs = typeof options.timeout === 'number' ? options.timeout : 0;
  let timeoutId;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }
  const res = await fetch(path, {
    ...options,
    headers,
    signal: controller.signal,
    body: headers['Content-Type'] === 'application/json' && options.body && typeof options.body === 'object'
      ? JSON.stringify(options.body)
      : options.body,
  }).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
  if (!res.ok) {
    let details = {};
    try { details = await res.json(); } catch {}
    const err = new Error(details.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.details = details;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}


