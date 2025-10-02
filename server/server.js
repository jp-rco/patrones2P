// server/server.js
// Servidor Express con HTTPS, CORS, Helmet y 3 endpoints protegidos por scope:
//  - GET /api/user   -> requiere user.read
//  - POST /api/user  -> requiere user.write
//  - GET /api/service-> requiere service.read
// Además, expone /oauth/token como "proxy" HTTPS hacia el token endpoint de Keycloak,
// para que el frontend siempre envíe credenciales y tokens a través de HTTPS local.

import fs from 'fs';
import https from 'https';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { requireAuth } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga .env desde /server (si existe)
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = Number(process.env.PORT || 3443);
// Si sirves el frontend desde este mismo servidor HTTPS, el origin será este mismo.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `https://localhost:${PORT}`;
const TOKEN_URL = process.env.TOKEN_URL; // ej: http://127.0.0.1:8080/realms/demo/protocol/openid-connect/token

const app = express();

// Seguridad de cabeceras
app.use(helmet());

// CORS (permite solo tu frontend)
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: false,
}));

// Logs
app.use(morgan('dev'));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------- Servir FRONTEND desde ../client ----------
const CLIENT_DIR = path.join(__dirname, '..', 'client');
app.use(express.static(CLIENT_DIR));

app.get('/', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

// --------- Proxy local -> TOKEN endpoint de Keycloak ----------
app.post('/oauth/token', async (req, res) => {
  try {
    if (!TOKEN_URL) {
      return res.status(500).json({ error: 'Falta TOKEN_URL en variables de entorno' });
    }

    // Normaliza el body a x-www-form-urlencoded
    const form = new URLSearchParams();
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) form.set(k, String(v));
    }

    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });

    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al solicitar token', detail: String(err) });
  }
});

// --------- API protegida por scopes ----------
app.get('/api/user', requireAuth(['user.read']), (req, res) => {
  res.json({
    ok: true,
    message: 'Contenido visible con scope user.read',
    who: req.tokenPayload?.preferred_username || 'desconocido'
  });
});

app.post('/api/user', requireAuth(['user.write']), (req, res) => {
  res.json({
    ok: true,
    message: 'Se guardó (ficticio) el contenido del usuario gracias a user.write',
    saved: req.body || {}
  });
});

app.get('/api/service', requireAuth(['service.read']), (_req, res) => {
  res.json({
    ok: true,
    message: 'Este endpoint es para microservicios con service.read',
    service: 'demo-service',
    at: new Date().toISOString()
  });
});

// --------- HTTPS Server ----------
const KEY_PATH  = path.join(__dirname, '..', 'keys', 'key.pem');
const CERT_PATH = path.join(__dirname, '..', 'keys', 'cert.pem');

const key  = fs.readFileSync(KEY_PATH);
const cert = fs.readFileSync(CERT_PATH);

https.createServer({ key, cert }, app).listen(PORT, () => {
  console.log(`API HTTPS protegida corriendo en https://localhost:${PORT}`);
  console.log(`Frontend simple en     https://localhost:${PORT}/`);
});
