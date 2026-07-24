require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const { STATUS, getProjects, getMetrics, updateProject } = require("./data");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN. Configúralo en el archivo .env");
  process.exit(1);
}

function parseIds(value) {
  return new Set(
    (value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
  );
}

const allowedIds = parseIds(process.env.TELEGRAM_ALLOWED_IDS);
const adminIds = parseIds(process.env.TELEGRAM_ADMIN_IDS);
const notifyChatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;

const ESTADOS = { progreso: "progress", activo: "active", ganado: "won" };

// Sin TELEGRAM_ALLOWED_IDS configurado, el bot queda abierto (comportamiento
// original) para no bloquear al dueño antes de que conozca su propio ID.
function isAllowed(id) {
  return allowedIds.size === 0 || allowedIds.has(id) || adminIds.has(id);
}

function isAdmin(id) {
  return adminIds.has(id);
}

const bot = new Telegraf(token);

bot.use((ctx, next) => {
  const id = ctx.from && ctx.from.id;
  if (!id || !isAllowed(id)) {
    if (ctx.reply) {
      ctx.reply(
        `⛔ No tienes autorización para usar este bot.\nTu ID de Telegram es: ${id}\n` +
          "Pídele al administrador que lo agregue a TELEGRAM_ALLOWED_IDS."
      );
    }
    return;
  }
  return next();
});

function progressBar(pct) {
  const filled = Math.round(pct / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function formatProject(p, index) {
  const status = STATUS[p.status];
  return (
    `${index}. ${status.emoji} *${p.title}*\n` +
    `   Cliente: ${p.client}\n` +
    `   Estado: ${p.badge}\n` +
    `   Avance: ${progressBar(p.progress)} ${p.progress}%\n` +
    `   Próximo paso: ${p.nextStep}`
  );
}

function projectsKeyboard(projects) {
  const rows = projects.map((p, i) => [
    Markup.button.callback(`${STATUS[p.status].emoji} ${p.title}`, `ver_${i}`),
  ]);
  return Markup.inlineKeyboard(rows);
}

function backKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Volver a la lista", "listar")]]);
}

function resumenText() {
  const m = getMetrics();
  return (
    "📊 *Resumen*\n\n" +
    `🚀 Proyectos activos: *${m.proyectosActivos}*\n` +
    `📄 En proceso de cotización: *${m.enProcesoCotizacion}*\n` +
    `🤝 Clientes involucrados: *${m.clientesInvolucrados}*`
  );
}

bot.start((ctx) =>
  ctx.reply(
    "👋 Hola, soy el bot de *CDP Digital*.\n\n" +
      "Puedo darte el estado de los proyectos del dashboard.\n\n" +
      `Tu ID de Telegram: \`${ctx.from.id}\``,
    { parse_mode: "Markdown", ...Markup.inlineKeyboard([
      [Markup.button.callback("📊 Resumen", "resumen"), Markup.button.callback("📋 Proyectos", "listar")],
    ]) }
  )
);

bot.help((ctx) =>
  ctx.reply(
    "Comandos disponibles:\n" +
      "/resumen — métricas generales\n" +
      "/proyectos — lista de todos los proyectos (con botones)\n" +
      "/proyecto <número> — detalle de un proyecto\n" +
      (isAdmin(ctx.from.id)
        ? "/actualizar <número> <avance> [progreso|activo|ganado] — actualiza un proyecto y notifica"
        : "")
  )
);

bot.command("resumen", (ctx) => ctx.reply(resumenText(), { parse_mode: "Markdown" }));

bot.action("resumen", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply(resumenText(), { parse_mode: "Markdown" });
});

bot.command("proyectos", (ctx) => {
  const projects = getProjects();
  ctx.reply("Selecciona un proyecto:", projectsKeyboard(projects));
});

bot.action("listar", async (ctx) => {
  await ctx.answerCbQuery();
  const projects = getProjects();
  ctx.editMessageText("Selecciona un proyecto:", projectsKeyboard(projects)).catch(() =>
    ctx.reply("Selecciona un proyecto:", projectsKeyboard(projects))
  );
});

bot.action(/^ver_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const idx = Number(ctx.match[1]);
  const projects = getProjects();
  const project = projects[idx];
  if (!project) return ctx.reply("Proyecto no encontrado.");
  ctx
    .editMessageText(formatProject(project, idx + 1), { parse_mode: "Markdown", ...backKeyboard() })
    .catch(() => ctx.reply(formatProject(project, idx + 1), { parse_mode: "Markdown", ...backKeyboard() }));
});

bot.command("proyecto", (ctx) => {
  const projects = getProjects();
  const arg = ctx.message.text.split(" ").slice(1).join(" ").trim();
  if (!arg) {
    return ctx.reply("Uso: /proyecto <número>\nEjemplo: /proyecto 1\n\nUsa /proyectos para ver la lista.");
  }
  const idx = parseInt(arg, 10);
  if (!Number.isInteger(idx) || idx < 1 || idx > projects.length) {
    return ctx.reply(`Número inválido. Usa un valor entre 1 y ${projects.length} (ver /proyectos).`);
  }
  ctx.reply(formatProject(projects[idx - 1], idx), { parse_mode: "Markdown" });
});

bot.command("actualizar", async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    if (adminIds.size === 0) {
      return ctx.reply(
        `⛔ Este comando requiere configurar TELEGRAM_ADMIN_IDS en .env.\nTu ID de Telegram: \`${ctx.from.id}\``,
        { parse_mode: "Markdown" }
      );
    }
    return ctx.reply("⛔ Solo un administrador puede usar este comando.");
  }

  const args = ctx.message.text.split(" ").slice(1);
  const [numStr, avanceStr, estadoStr] = args;
  const projects = getProjects();
  const idx = parseInt(numStr, 10) - 1;
  const avance = parseInt(avanceStr, 10);
  const estado = estadoStr ? ESTADOS[estadoStr.toLowerCase()] : undefined;

  if (!Number.isInteger(idx) || idx < 0 || idx >= projects.length) {
    return ctx.reply(`Uso: /actualizar <número> <avance 0-100> [progreso|activo|ganado]\n(número entre 1 y ${projects.length})`);
  }
  if (!Number.isInteger(avance) || avance < 0 || avance > 100) {
    return ctx.reply("El avance debe ser un número entre 0 y 100.");
  }
  if (estadoStr && !estado) {
    return ctx.reply("Estado inválido. Usa: progreso | activo | ganado.");
  }

  const { project, before } = updateProject(idx, { progress: avance, status: estado });

  await ctx.reply(`✅ Actualizado: *${project.title}*`, { parse_mode: "Markdown" });

  const notifyText =
    `🔔 *Actualización de proyecto*\n\n` +
    `${STATUS[project.status].emoji} *${project.title}*\n` +
    `Cliente: ${project.client}\n` +
    `Avance: ${before.progress}% → *${project.progress}%*\n` +
    `Estado: ${STATUS[before.status].label} → *${STATUS[project.status].label}*\n` +
    `Actualizado por: ${ctx.from.first_name || ctx.from.id}`;

  if (notifyChatId) {
    bot.telegram.sendMessage(notifyChatId, notifyText, { parse_mode: "Markdown" }).catch((err) => {
      console.error("No se pudo enviar la notificación:", err.message);
    });
  }
});

bot.launch();
console.log("Bot de Telegram iniciado.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
