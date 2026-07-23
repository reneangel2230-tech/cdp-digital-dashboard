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

- `/start` — mensaje de bienvenida
- `/help` — lista de comandos
- `/resumen` — métricas generales (proyectos activos, en cotización, clientes)
- `/proyectos` — lista de todos los proyectos con estado y avance
- `/proyecto <número>` — detalle de un proyecto puntual

## Actualizar los datos

Los datos que consulta el bot están en `data.js`. Si el dashboard (`../index.html`)
cambia, actualiza `data.js` a mano para mantenerlos sincronizados.

## Despliegue

Este script usa *long polling* (`bot.launch()`), por lo que solo necesita
correr en cualquier proceso con salida a internet — no requiere un dominio ni
webhook. Puede alojarse en un VPS, Railway, Render (worker), o correr
localmente mientras se necesite.
