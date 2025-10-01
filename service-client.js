// service-client.js
// Script que actúa como "microservicio cliente": toma un token por client_credentials
// y llama al API /api/service con ese token.

import 'dotenv/config';

const BASE = `https://localhost:${process.env.PORT || 3443}`;

async function main() {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: 'service-client',
    client_secret: 'PEGA_AQUI_SECRET_SERVICE',
    scope: 'service.read'
  });

  // 1) Obtener token vía nuestro proxy HTTPS
  const tr = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const tokenJson = await tr.json();
  if (!tr.ok) {
    console.error('Fallo token:', tokenJson);
    process.exit(1);
  }

  // 2) Usar el token contra el API protegido
  const r = await fetch(`${BASE}/api/service`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });

  console.log('Status API:', r.status);
  console.log('Body:', await r.json());
}

main().catch(console.error);
