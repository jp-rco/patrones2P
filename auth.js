// auth.js
// Carga .env ANTES de leer variables y crea el JWKS de forma segura/lazy.

import dotenv from 'dotenv';
dotenv.config();

import { createRemoteJWKSet, jwtVerify } from 'jose';

let JWKS; // lo inicializamos lazy para evitar fallos si aún no hay env listo

function getConfig() {
  const ISSUER = process.env.ISSUER;
  const JWKS_URI = process.env.JWKS_URI;

  if (!ISSUER) {
    throw new Error('Config faltante: ISSUER no está definido en .env');
  }
  if (!JWKS_URI) {
    throw new Error('Config faltante: JWKS_URI no está definido en .env');
  }
  return { ISSUER, JWKS_URI };
}

function getJWKS(JWKS_URI) {
  if (!JWKS) {
    JWKS = createRemoteJWKSet(new URL(JWKS_URI));
  }
  return JWKS;
}

/**
 * Middleware: valida JWT (firma/issuer/exp) y que tenga los scopes requeridos.
 * Uso: app.get('/api/user', requireAuth(['user.read']), handler)
 */
export function requireAuth(requiredScopes = []) {
  return async function (req, res, next) {
    let cfg;
    try {
      cfg = getConfig();
    } catch (e) {
      // Si falta config, que se vea claro en dev:
      return res.status(500).json({ error: 'Configuración inválida', detail: String(e) });
    }

    try {
      const auth = req.headers.authorization || '';
      const [scheme, token] = auth.split(' ');

      if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Falta header Authorization: Bearer <token>' });
      }

      const { payload } = await jwtVerify(token, getJWKS(cfg.JWKS_URI), {
        issuer: cfg.ISSUER,
      });

      const scopeStr = payload.scope || '';
      const tokenScopes = new Set(scopeStr.split(' ').filter(Boolean));

      const missing = requiredScopes.filter(s => !tokenScopes.has(s));
      if (missing.length) {
        return res.status(403).json({
          error: 'Faltan scopes en el token',
          required: requiredScopes,
          present: [...tokenScopes],
        });
      }

      req.tokenPayload = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado', detail: String(err) });
    }
  };
}
