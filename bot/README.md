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

## Despliegue

Este script usa *long polling* (`bot.launch()`), por lo que solo necesita
correr en cualquier proceso con salida a internet — no requiere un dominio ni
webhook. Puede alojarse en un VPS, Railway, Render (worker), o correr
localmente mientras se necesite.
