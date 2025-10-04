¡Entendido! 🙌 Aquí tienes el **README.md** en un solo formato uniforme (sin bloques de `bash` ni diferencias de estilo). Todo estará en **Markdown plano** con secciones y ejemplos en JSON cuando sea necesario, para que copies y pegues directamente.

# Parcial 2 – OAuth2 con Keycloak, Node.js y API protegida

Este proyecto implementa un Authorization Server con Keycloak y un API protegido en Node.js (Express) sobre HTTPS, cumpliendo los requisitos del parcial:

- Flujo Password Grant + Refresh Token para usuarios finales.  
- Flujo Client Credentials para comunicación entre servicios.  
- Validación de scopes en cada endpoint protegido.  
- Expiración e invalidación de tokens.  
- Tokens transmitidos por HTTPS hacia el API.  
- Frontend sencillo en HTML/JS para interactuar con los flujos.  

---

## Requisitos previos

- Node.js 18 o superior  
- Docker Desktop  
- OpenSSL (para generar certificados locales)

---

## Instalación y configuración

1. Clonar el proyecto y entrar a la carpeta:  
   git clone <REPO_URL>  
   cd parcial2-oauth  

2. Instalar dependencias de Node:  
   npm install  

3. Generar certificados locales para HTTPS:  
   openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -subj "/CN=localhost" -days 365  


## Levantar los servicios

1. Keycloak (Authorization Server):  
docker run --name keycloak -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:24.0 start-dev  

Abrir la consola en: http://localhost:8080  
Usuario: admin / admin  

2. API HTTPS + Frontend:  
npm run start  

Se expone en: https://localhost:3443  


## Configuración en Keycloak

1. Crear Realm: parcial2  
2. Crear usuario:  
- Username: alice  
- Password: 123456 (disable temporary)  
3. Crear clientes:  
- frontend-client → Confidential, habilitar Direct Access Grants  
- service-client → Confidential, habilitar Service Accounts  
4. Asignar secrets (ejemplo usado en pruebas):  
- frontend-client → gVGB0DymCJIiJVcyxUBGqkQYi8KV1rVK  
- service-client → 5nVfhK3Cso3dTIU4uwOdvPsJzEF59bif  
5. Scopes:  
- user.read, user.write, service.read, service.write  
- Asignar a cada cliente según corresponda  
6. Configurar expiración:  
Realm Settings → Tokens → Access token lifespan = 1 minuto (para evidenciar expiración).  


## Endpoints implementados

- POST /oauth/token → Proxy HTTPS al token endpoint de Keycloak.  
- GET /api/user → Requiere scope user.read.  
- POST /api/user → Requiere scope user.write.  
- GET /api/service → Requiere scope service.read.  


## Pruebas en Postman

Todos los request se hacen contra https://localhost:3443

### 1. Password Grant (obtener access y refresh)

POST /oauth/token  
Body (raw JSON):

{
"grant_type": "password",
"client_id": "frontend-client",
"client_secret": "gVGB0DymCJIiJVcyxUBGqkQYi8KV1rVK",
"username": "alice",
"password": "123456",
"scope": "user.read user.write"
}
---

### 2. GET protegido (user.read)

GET /api/user
Auth → Bearer Token = access_token devuelto arriba.

---

### 3. POST protegido (user.write)

POST /api/user
Auth → Bearer Token
Body:

{
  "note": "Este es un dato guardado con user.write"
}




### 4. Refresh Token

POST /oauth/token
Body:


{
  "grant_type": "refresh_token",
  "client_id": "frontend-client",
  "client_secret": "gVGB0DymCJIiJVcyxUBGqkQYi8KV1rVK",
  "refresh_token": "PEGA_REFRESH_TOKEN_AQUI"
}

---

### 5. Client Credentials

POST /oauth/token
Body:

{
  "grant_type": "client_credentials",
  "client_id": "service-client",
  "client_secret": "5nVfhK3Cso3dTIU4uwOdvPsJzEF59bif",
  "scope": "service.read"
}


Con el access_token obtenido → GET /api/service

---

## Tecnologías usadas

* Keycloak – Authorization Server (OpenID Connect, OAuth2).
* Node.js + Express – API protegida en HTTPS.
* jose – Validación de JWT con JWKS remoto.
* Helmet, CORS, Morgan – Seguridad y logs básicos.
* Frontend simple – HTML, JS, CSS.

---

## Notas finales

* El API corre en HTTPS con certificado local (key.pem y cert.pem).
* Todos los tokens se transmiten por HTTPS hacia el API.
* El proyecto cumple con los flujos y validaciones solicitadas en el parcial.

```
