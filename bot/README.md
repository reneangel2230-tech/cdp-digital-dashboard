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
- `/playa` — sub-proyectos de *Propiedades de la Playa* (categoría separada,
  no cuenta en `/resumen` ni en la lista de `/proyectos`)
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
en el estado persistente (ver sección "Persistencia de los datos" más abajo),
y si configuras `TELEGRAM_NOTIFY_CHAT_ID` (el ID de un chat o canal), envía
ahí un aviso automático con el cambio (antes → después).

Para obtener el ID de un canal/grupo: agrega el bot a ese chat y usa cualquier
bot auxiliar tipo @userinfobot, o revisa los logs del bot al recibir un mensaje
ahí.

## Actualizar los datos

`state.seed.json` es la carga inicial versionada en git — edítalo a mano
cuando quieras cambiar los datos "de fábrica" del bot (por ejemplo, para
llevar al repo un cambio hecho en el dashboard). Los textos fijos de cada
proyecto (título, cliente, próximo paso) deben mantenerse sincronizados
manualmente con `../index.html` si el dashboard cambia.

Cada proyecto tiene un campo `category` (`"cdp"` o `"playa"`). Los proyectos
`"cdp"` son los que aparecen en `index.html` y en `/proyectos` / `/resumen`;
los `"playa"` son personales y solo se ven con `/playa`. Si no se especifica
`category`, se asume `"cdp"` (así `/nuevo` sigue funcionando igual que antes).

## Persistencia de los datos

El bot separa dos archivos:

- **`state.seed.json`** — versionado en git, es la carga inicial.
- **`.data/state.json`** (o `$DATA_DIR/state.json`) — el estado *vivo*, donde
  se guardan los cambios hechos con `/actualizar`, `/nuevo`, `/nota` o los
  botones. No está en git (`.gitignore`).

La primera vez que el bot arranca y no encuentra `.data/state.json`, lo crea
copiando `state.seed.json`. De ahí en adelante, todos los cambios se guardan
solo en `.data/state.json`.

**Localmente**, `.data/` vive dentro de `bot/` y es efímero como cualquier
carpeta del proyecto (se borra si borras el repo). Para producción, hay que
apuntar `DATA_DIR` a un disco que sobreviva a los redeploys:

### Configurar el volumen en Railway

1. En el servicio del bot, ve a **Settings → Volumes** → **New Volume**.
2. Ponle un **Mount Path**, por ejemplo `/data`.
3. En **Variables**, agrega:
   ```
   DATA_DIR=/data
   ```
4. Redeploy. La primera vez el bot copia `state.seed.json` a `/data/state.json`;
   en los siguientes deploys, como `/data` es el volumen (no el contenedor
   efímero), esos datos ya no se pierden.

**Importante:** una vez que el volumen tiene su propio `state.json`, editar
`state.seed.json` en git **ya no actualiza automáticamente** la producción
(solo afecta a instalaciones nuevas que arrancan sin volumen). Si necesitas
corregir algo que ya está en el volumen, hazlo con `/actualizar`, `/nota` o
los botones del bot directamente.

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
7. Para que los datos sobrevivan a los redeploys, configura un volumen — ver
   "Persistencia de los datos" más abajo.

## Alternativas

- **Render**: mismo flujo (crear cuenta, conectar el repo, Root Directory
  `bot`, Build Command `npm install`, Start Command `node index.js`, como
  *Background Worker* en vez de *Web Service*).
- **VPS propio**: clona el repo, corre los pasos de instalación, y usa
  `pm2 start index.js --name cdp-bot` o un servicio de `systemd` para que
  siga corriendo tras un reinicio.
