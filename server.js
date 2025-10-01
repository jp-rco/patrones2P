// server.js
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3443);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `https://localhost:${PORT}`;
const TOKEN_URL = process.env.TOKEN_URL;

const app = express();

// Seguridad básica de headers
app.use(helmet());

// CORS: solo permitimos el frontend local en HTTPS
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: false,
}));

// Logs bonitos en consola
app.use(morgan('dev'));

// Para parsear body de formularios y JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Servimos el frontend minimalista directamente desde raíz ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/client.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.js'));
});
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

// --- Proxy HTTPS local -> Token endpoint de Keycloak (dev/academico) ---
// Así garantizamos que desde el navegador TODO va por HTTPS hasta nuestro server.
// Luego, del server a Keycloak va por loopback HTTP (solo local).
app.post('/oauth/token', async (req, res) => {
  try {
    const form = new URLSearchParams();

    // Aceptamos tanto x-www-form-urlencoded como JSON simple por comodidad
    const body = typeof req.body === 'object' ? req.body : {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) form.set(k, String(v));
    }

    // Por si el cliente ya nos envía como x-www-form-urlencoded (req.body vacío)
    if (!form.has('grant_type') && req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      // Reconstruimos desde raw body si fuese necesario (sencillo para la demo)
      // Pero como usamos express.urlencoded, lo normal es que arriba ya esté en body.
    }

    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al solicitar token', detail: String(err) });
  }
});

// --- API protegida por scopes ---
app.get('/api/user', requireAuth(['user.read']), (req, res) => {
  // Ejemplo de recurso "de usuario"
  res.json({
    ok: true,
    message: 'Contenido visible con scope user.read',
    who: req.tokenPayload?.preferred_username || 'desconocido'
  });
});

app.post('/api/user', requireAuth(['user.write']), (req, res) => {
  // Ejemplo de "escritura" de usuario (solo demo)
  const payload = req.body || {};
  res.json({
    ok: true,
    message: 'Se guardó (ficticio) el contenido del usuario gracias a user.write',
    saved: payload
  });
});

app.get('/api/service', requireAuth(['service.read']), (req, res) => {
  // Recurso para comunicación entre servicios (Client Credentials)
  res.json({
    ok: true,
    message: 'Este endpoint es para microservicios con service.read',
    service: 'demo-service',
    at: new Date().toISOString()
  });
});

// --- Arranque en HTTPS ---
const key = fs.readFileSync(path.join(__dirname, 'key.pem'));
const cert = fs.readFileSync(path.join(__dirname, 'cert.pem'));

https.createServer({ key, cert }, app).listen(PORT, () => {
  console.log(`API HTTPS protegida corriendo en https://localhost:${PORT}`);
  console.log(`Frontend simple en     https://localhost:${PORT}/`);
});
