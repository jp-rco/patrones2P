// client.js
// Código simple, directo y comentado "como de compa".
// Hace fetch al proxy HTTPS /oauth/token y a los endpoints del API.

const $ = (id) => document.getElementById(id);
const BASE = location.origin; // https://localhost:3443

let state = {
  access_token: null,
  refresh_token: null,
  expires_in: null,
};

function show(el, data) {
  el.textContent = JSON.stringify(data, null, 2);
}

async function tokenRequest(params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await res.json();
  return { status: res.status, json };
}

// --- Password Grant ---
$('btn-login').onclick = async () => {
  const client_id = $('fcid').value.trim();
  const client_secret = $('fsec').value.trim();
  const username = $('user').value.trim();
  const password = $('pass').value.trim();
  const scope = $('fscopes').value.trim();

  const { status, json } = await tokenRequest({
    grant_type: 'password',
    client_id, client_secret,
    username, password,
    scope
  });

  show($('login-out'), { status, ...json });

  if (status === 200 && json.access_token) {
    state.access_token = json.access_token;
    state.refresh_token = json.refresh_token;
    state.expires_in = json.expires_in;
    $('atk').value = state.access_token;
    $('btn-refresh').disabled = !json.refresh_token;
  }
};

// --- Refresh Token ---
$('btn-refresh').onclick = async () => {
  if (!state.refresh_token) return;

  const client_id = $('fcid').value.trim();
  const client_secret = $('fsec').value.trim();

  const { status, json } = await tokenRequest({
    grant_type: 'refresh_token',
    client_id, client_secret,
    refresh_token: state.refresh_token
  });

  show($('login-out'), { status, ...json });

  if (status === 200 && json.access_token) {
    state.access_token = json.access_token;
    state.refresh_token = json.refresh_token;
    state.expires_in = json.expires_in;
    $('atk').value = state.access_token;
  }
};

// --- Consumo del API con el access_token actual ---
async function callApi(method, path, body) {
  const token = $('atk').value.trim();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  return { status: res.status, json };
}

$('btn-user-get').onclick = async () => {
  const { status, json } = await callApi('GET', '/api/user');
  show($('api-out'), { status, ...json });
};

$('btn-user-post').onclick = async () => {
  const payload = { note: 'Hola profe, esto es un post de demo :)' };
  const { status, json } = await callApi('POST', '/api/user', payload);
  show($('api-out'), { status, ...json });
};

// --- Client Credentials (rápido desde el navegador) ---
$('btn-cc').onclick = async () => {
  const client_id = $('scid').value.trim();
  const client_secret = $('ssec').value.trim();
  const scope = $('sscopes').value.trim();

  const t = await tokenRequest({
    grant_type: 'client_credentials',
    client_id, client_secret, scope
  });

  if (t.status !== 200) {
    show($('cc-out'), t);
    return;
  }

  const ccToken = t.json.access_token;
  const res = await fetch(`${BASE}/api/service`, {
    headers: { 'Authorization': `Bearer ${ccToken}` }
  });
  const json = await res.json();
  show($('cc-out'), { token_status: t.status, api_status: res.status, ...json });
};
