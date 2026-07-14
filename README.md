# CDP Digital — Dashboard de Proyectos

Dashboard estático (`index.html`) con el resumen de avances de los proyectos de CDP Digital, con la opción de enviar una actualización a grupos de WhatsApp con un botón.

## Estructura

- `index.html` — dashboard estático. Carga los datos desde `data/projects.json` y los renderiza.
- `data/projects.json` — fuente única de datos de los proyectos (título, cliente, estado, % de avance, próximo paso). Edítalo para actualizar el dashboard; tanto la página como el mensaje de WhatsApp se generan a partir de este archivo.
- `server/` — servicio backend en Node.js que mantiene una sesión de WhatsApp Web y expone una API para enviar la actualización a uno o varios grupos.

## Cómo funciona el envío a WhatsApp

WhatsApp no permite enviar mensajes a grupos usando su API oficial (Meta Cloud API / Twilio) — esa API solo soporta chats 1:1 con contactos que hayan dado opt-in. Para publicar en grupos reales, el backend usa **[whatsapp-web.js](https://wwebjs.dev/)**, que automatiza una sesión de WhatsApp Web con el número que ya pertenece a los grupos.

> ⚠️ Esto usa una API no oficial. No está soportada por Meta y su uso indebido (spam, envíos masivos) puede provocar el bloqueo del número. Úsalo con un número dedicado y con moderación.

### Flujo

1. El backend arranca y genera un código QR.
2. Escaneas el QR desde el WhatsApp del número que pertenece a los grupos (WhatsApp → Dispositivos vinculados → Vincular un dispositivo).
3. La sesión queda guardada en disco (`server/.wwebjs_auth`), así que no hay que volver a escanear en cada reinicio (siempre que el volumen sea persistente).
4. Desde el dashboard, al presionar **"Enviar actualización a WhatsApp"**, el navegador llama al backend (`POST /send-update`), que arma el mensaje a partir de `data/projects.json` y lo envía a los grupos configurados.

## 1. Desplegar el backend (`server/`)

El backend necesita correr 24/7 con Chromium disponible (lo usa whatsapp-web.js internamente) y con un **disco persistente** para no perder la sesión de WhatsApp en cada despliegue. Opciones recomendadas: [Railway](https://railway.app), [Render](https://render.com) (con un *persistent disk*), o un VPS propio.

```bash
cd server
cp .env.example .env
# Edita .env: define SEND_API_KEY, ALLOWED_ORIGIN y (luego) WHATSAPP_GROUP_IDS
npm install
npm start
```

Al arrancar por primera vez:

1. Abre `https://<tu-backend>/qr` en el navegador y escanea el código con WhatsApp.
2. Cuando la sesión quede lista, `GET /status` responderá `{"status":"READY"}`.
3. Obtén los IDs de los grupos con `GET /groups` (requiere el header `X-API-Key`):
   ```bash
   curl -H "X-API-Key: TU_SEND_API_KEY" https://<tu-backend>/groups
   ```
4. Copia los IDs (formato `123456789-987654321@g.us`) al `.env` en `WHATSAPP_GROUP_IDS`, separados por coma, y reinicia el servicio.

### Endpoints

| Método | Ruta            | Auth       | Descripción                                             |
|--------|-----------------|------------|----------------------------------------------------------|
| GET    | `/status`       | —          | Estado de la conexión (`INITIALIZING`, `QR`, `READY`)     |
| GET    | `/qr`           | —          | Página con el código QR para vincular el dispositivo      |
| GET    | `/groups`       | X-API-Key  | Lista los grupos donde está el número, con su ID          |
| POST   | `/send-update`  | X-API-Key  | Envía el resumen de `data/projects.json` a los grupos configurados (o a `{ "groupIds": [...] }` si se pasan en el body) |

## 2. Configurar el dashboard

El dashboard (`index.html`) es estático y puede alojarse donde ya está (por ejemplo GitHub Pages). Solo necesita saber a qué backend llamar:

1. Abre el dashboard y haz clic en **"Configurar conexión"**.
2. Ingresa la URL pública del backend (ej. `https://tu-backend.onrender.com`) y la `SEND_API_KEY` que configuraste.
3. Estos datos se guardan solo en el `localStorage` del navegador, no se suben al repositorio.
4. Haz clic en **"Enviar actualización a WhatsApp"** para publicar el resumen de avances en los grupos configurados.

## Actualizar los avances

Edita `data/projects.json` (título, cliente, estado, `progress`, `nextStep`) y confirma el cambio. El dashboard y el próximo mensaje de WhatsApp reflejarán automáticamente los nuevos datos.
