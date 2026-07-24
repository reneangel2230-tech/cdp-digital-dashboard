# Bot de Telegram — CDP Digital

Bot que responde con el estado de los proyectos mostrados en `index.html`.

## 1. Crear el bot en Telegram

1. Abre Telegram y busca **@BotFather**.
2. Envía `/newbot` y sigue las instrucciones (nombre y username del bot).
3. BotFather te entregará un **token** (algo como `123456789:ABC-...`). Guárdalo.

## 2. Configurar el proyecto

```bash
cd bot
npm install
cp .env.example .env
```

Edita `.env` y pega el token:

```
TELEGRAM_BOT_TOKEN=tu_token_aqui
```

## 3. Ejecutar

```bash
npm start
```

## Comandos del bot

- `/start` — mensaje de bienvenida, muestra tu ID de Telegram y botones rápidos
- `/help` — lista de comandos
- `/resumen` — métricas generales (proyectos activos, en cotización, clientes)
- `/proyectos` — lista de todos los proyectos con botones para ver el detalle
- `/proyecto <número>` — detalle de un proyecto puntual
- `/actualizar <número> <avance> [progreso|activo|ganado]` — solo administradores;
  actualiza el avance/estado de un proyecto y notifica el cambio

## Restringir quién puede usar el bot

Por defecto el bot es abierto: cualquiera que lo encuentre en Telegram puede
consultarlo. Para restringirlo:

1. Envía `/start` al bot — te responderá con tu ID de Telegram.
2. En `.env`, agrega tu ID (y los de quien más quieras autorizar) a
   `TELEGRAM_ALLOWED_IDS`, separados por coma:
   ```
   TELEGRAM_ALLOWED_IDS=111111111,222222222
   ```
3. Reinicia el bot. Solo esos IDs podrán usarlo; el resto recibirá un mensaje
   de "no autorizado" (que también les muestra su propio ID, para pedir acceso).

## Actualizar proyectos y notificaciones

`TELEGRAM_ADMIN_IDS` define quién puede usar `/actualizar` (mismo formato que
`TELEGRAM_ALLOWED_IDS`). Ejemplo:

```
/actualizar 2 75 activo
```

Esto pone el proyecto #2 en 75% de avance y estado "activo", guarda el cambio
en `state.json`, y si configuras `TELEGRAM_NOTIFY_CHAT_ID` (el ID de un chat o
canal), envía ahí un aviso automático con el cambio (antes → después).

Para obtener el ID de un canal/grupo: agrega el bot a ese chat y usa cualquier
bot auxiliar tipo @userinfobot, o revisa los logs del bot al recibir un mensaje
ahí.

## Actualizar los datos

Los datos base viven en `state.json` (se actualizan solos con `/actualizar`,
o edítalos a mano). Los textos fijos de cada proyecto (título, cliente,
próximo paso) deben mantenerse sincronizados manualmente con `../index.html`
si el dashboard cambia.

## Despliegue permanente (Railway)

Este script usa *long polling* (`bot.launch()`): no necesita dominio ni
webhook, solo un proceso corriendo con salida a internet. Railway tiene un
plan gratuito con eso alcanza.

1. Entra a [railway.app](https://railway.app) e inicia sesión con tu cuenta
   de GitHub (la misma donde está `cdp-digital-dashboard`).
2. **New Project → Deploy from GitHub repo** → selecciona
   `reneangel2230-tech/cdp-digital-dashboard`. Autoriza a Railway si te lo pide.
3. Una vez creado el servicio, entra a **Settings** y en **Root Directory**
   escribe `bot` (así Railway instala y corre solo esta carpeta).
4. Ve a la pestaña **Variables** y agrega:
   ```
   TELEGRAM_BOT_TOKEN=tu_token
   TELEGRAM_ALLOWED_IDS=tu_id
   TELEGRAM_ADMIN_IDS=tu_id
   TELEGRAM_NOTIFY_CHAT_ID=   (opcional)
   ```
5. Railway detecta `package.json`/`railway.toml` automáticamente y corre
   `node index.js`. Revisa la pestaña **Deployments → Logs**: debe decir
   `Bot de Telegram iniciado.`
6. No actives "Public Networking" — el bot no expone un puerto HTTP, solo
   necesita que el proceso siga vivo.

**Nota sobre `state.json`:** cada nuevo deploy (por ejemplo, al hacer push a
la rama) reinicia el contenedor con el `state.json` que está en el repo. Si
usas `/actualizar`, `/nuevo` o los botones para cambiar datos en producción,
esos cambios viven solo en ese contenedor hasta el próximo deploy — no se
reflejan de vuelta en GitHub automáticamente.

## Alternativas

- **Render**: mismo flujo (crear cuenta, conectar el repo, Root Directory
  `bot`, Build Command `npm install`, Start Command `node index.js`, como
  *Background Worker* en vez de *Web Service*).
- **VPS propio**: clona el repo, corre los pasos de instalación, y usa
  `pm2 start index.js --name cdp-bot` o un servicio de `systemd` para que
  siga corriendo tras un reinicio.
