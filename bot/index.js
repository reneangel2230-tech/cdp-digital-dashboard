require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const {
  STATUS,
  getProjects,
  getCategoryProjects,
  getMetrics,
  updateProject,
  addProject,
  setFinancials,
  setQuote,
  setDates,
  getInvestmentSummary,
  getTimeline,
} = require("./data");

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

const ESTADOS = { progreso: "progress", activo: "active", ganado: "won", perdido: "lost" };

// Sin TELEGRAM_ALLOWED_IDS configurado, el bot queda abierto (comportamiento
// original) para no bloquear al dueño antes de que conozca su propio ID.
function isAllowed(id) {
  return allowedIds.size === 0 || allowedIds.has(id) || adminIds.has(id);
}

function isAdmin(id) {
  return adminIds.has(id);
}

// Devuelve true si ctx.from puede continuar; si no, ya respondió el motivo.
function requireAdmin(ctx) {
  if (isAdmin(ctx.from.id)) return true;
  if (adminIds.size === 0) {
    ctx.reply(
      `⛔ Este comando requiere configurar TELEGRAM_ADMIN_IDS en .env.\nTu ID de Telegram: \`${ctx.from.id}\``,
      { parse_mode: "Markdown" }
    );
  } else {
    ctx.reply("⛔ Solo un administrador puede usar este comando.");
  }
  return false;
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
  let text =
    `${index}. ${status.emoji} *${p.title}*\n` +
    `   Cliente: ${p.client}\n` +
    `   Estado: ${p.badge}\n` +
    `   Avance: ${progressBar(p.progress)} ${p.progress}%\n` +
    `   Próximo paso: ${p.nextStep}`;
  if (p.quote) text += `\n\n${formatQuoteText(p.quote)}`;
  return text;
}

function projectsKeyboard(pairs) {
  const rows = pairs.map(({ project, index }) => [
    Markup.button.callback(`${STATUS[project.status].emoji} ${project.title}`, `ver_${index}`),
  ]);
  rows.push([Markup.button.callback("🏠 Menú principal", "menu")]);
  return Markup.inlineKeyboard(rows);
}

function backActionFor(project) {
  return project.category === "playa" ? "listar_playa" : "listar";
}

function detailKeyboard(idx, adminUser, backAction) {
  const rows = [];
  if (adminUser) {
    rows.push([
      Markup.button.callback("➖10%", `bump_${idx}_-10`),
      Markup.button.callback("➕10%", `bump_${idx}_10`),
    ]);
    rows.push([
      Markup.button.callback("🟠 Progreso", `estado_${idx}_progress`),
      Markup.button.callback("🔵 Activo", `estado_${idx}_active`),
    ]);
    rows.push([
      Markup.button.callback("🟢 Ganado", `estado_${idx}_won`),
      Markup.button.callback("🔴 Perdido", `estado_${idx}_lost`),
    ]);
  }
  rows.push([Markup.button.callback("⬅️ Volver a la lista", backAction)]);
  return Markup.inlineKeyboard(rows);
}

function notifyUpdate(ctx, project, before) {
  if (!notifyChatId) return;
  const notifyText =
    `🔔 *Actualización de proyecto*\n\n` +
    `${STATUS[project.status].emoji} *${project.title}*\n` +
    `Cliente: ${project.client}\n` +
    `Avance: ${before.progress}% → *${project.progress}%*\n` +
    `Estado: ${STATUS[before.status].label} → *${STATUS[project.status].label}*\n` +
    `Actualizado por: ${ctx.from.first_name || ctx.from.id}`;
  bot.telegram
    .sendMessage(notifyChatId, notifyText, { parse_mode: "Markdown" })
    .catch((err) => console.error("No se pudo enviar la notificación:", err.message));
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

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📊 Resumen", "resumen")],
    [Markup.button.callback("📋 CDP Digital", "listar"), Markup.button.callback("🏖️ Playa", "listar_playa")],
    [Markup.button.callback("💰 Inversión (Playa)", "inversion"), Markup.button.callback("🗓️ Cronograma", "cronograma")],
  ]);
}

function formatUSD(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatInvestmentLine(project, index) {
  let line = `${index}. *${project.title}*\n   Inversión: ${project.investment}`;
  if (project.roi) line += `\n   ROI: ${project.roi}`;
  if (project.payback) line += `\n   Payback: ${project.payback}`;
  return line;
}

function inversionText() {
  const { projects, approxTotal } = getInvestmentSummary("playa");
  if (!projects.length) {
    return "💰 *Inversión — Playa*\n\nTodavía no hay montos cargados. Usa /finanzas para agregarlos.";
  }
  const lines = projects.map(({ project, index }) => formatInvestmentLine(project, index + 1));
  return (
    "💰 *Inversión — Propiedades de la Playa*\n\n" +
    lines.join("\n\n") +
    `\n\n_Total estimado: ~${formatUSD(approxTotal)} (aproximado — varios montos son rangos o tienen más de una partida)_`
  );
}

function formatTimelineLine(project, index) {
  const start = project.startDate || "sin definir";
  const target = project.targetDate || "sin definir";
  return `${index}. *${project.title}*\n   Cliente: ${project.client}\n   Inicio: ${start} · Objetivo: ${target}`;
}

function formatQuoteText(quote) {
  const lines = quote.items.map((item) => {
    const isTotal = !item.qty && !item.unit;
    const total = item.total ? `$${item.total}` : "";
    return isTotal ? `   *${item.desc}: ${total}*` : `   ${item.qty} × ${item.desc} — ${total}`;
  });
  let text = `📄 *${quote.title}*\n\n` + lines.join("\n");
  if (quote.note) text += `\n\n_${quote.note}_`;
  return text;
}

// Formato de /cotizacion (una línea de comando + cuerpo multilínea):
//   /cotizacion <número>
//   <título>
//   <cant>|<descripción>|<precio unit>|<total>       (fila normal)
//   |<descripción total>||<<total>                    (fila de subtotal/total, sin cant ni precio unit)
//   ---                                                (separador opcional)
//   <nota>
function parseQuoteBody(bodyLines) {
  const title = bodyLines[0];
  const rest = bodyLines.slice(1);
  const sepIdx = rest.indexOf("---");
  const tableLines = sepIdx === -1 ? rest : rest.slice(0, sepIdx);
  const note = sepIdx === -1 ? undefined : rest.slice(sepIdx + 1).join(" ").trim() || undefined;
  if (!tableLines.length) return null;
  const items = tableLines.map((line) => {
    const [qty, desc, unit, total] = line.split("|").map((p) => (p !== undefined ? p.trim() : ""));
    return { qty, desc: desc || "", unit, total };
  });
  return { title, items, note };
}

function cronogramaText(category) {
  const label = category === "playa" ? "Playa" : "CDP Digital";
  const timeline = getTimeline(category);
  if (!timeline.length) return `🗓️ *Cronograma — ${label}*\n\nNo hay proyectos en esta categoría.`;
  const lines = timeline.map(({ project, index }) => formatTimelineLine(project, index + 1));
  const sinFecha = timeline.filter(({ project }) => !project.targetDate).length;
  let text = `🗓️ *Cronograma — ${label}*\n\n` + lines.join("\n\n");
  if (sinFecha) text += `\n\n_${sinFecha} proyecto(s) sin fecha objetivo definida. Usa /fecha para cargarlas._`;
  return text;
}

bot.start((ctx) =>
  ctx.reply(
    "👋 Hola, soy el bot de *CDP Digital*.\n\n" +
      "Elige qué quieres ver:\n\n" +
      `Tu ID de Telegram: \`${ctx.from.id}\``,
    { parse_mode: "Markdown", ...mainMenuKeyboard() }
  )
);

bot.command("menu", (ctx) => ctx.reply("¿Qué quieres ver?", mainMenuKeyboard()));

bot.action("menu", async (ctx) => {
  await ctx.answerCbQuery();
  const keyboard = mainMenuKeyboard();
  ctx
    .editMessageText("¿Qué quieres ver?", keyboard)
    .catch(() => ctx.reply("¿Qué quieres ver?", keyboard));
});

bot.help((ctx) =>
  ctx.reply(
    "Comandos disponibles:\n" +
      "/menu — menú principal con botones\n" +
      "/resumen — métricas generales\n" +
      "/proyectos — lista de todos los proyectos (con botones)\n" +
      "/proyecto <número> — detalle de un proyecto\n" +
      "/playa — sub-proyectos de Propiedades de la Playa\n" +
      "/inversion — monto, ROI y payback de los proyectos de Playa\n" +
      "/cronograma [playa] — proyectos con fecha de inicio/objetivo (CDP por defecto)\n" +
      (isAdmin(ctx.from.id)
        ? "/actualizar <número> <avance> [progreso|activo|ganado|perdido] — actualiza un proyecto y notifica\n" +
          "/nuevo Título | Cliente | avance | estado | próximo paso — crea un proyecto\n" +
          "/nota <número> <texto> — actualiza el próximo paso de un proyecto\n" +
          "/finanzas <número> | <inversión> | <ROI> | <payback opcional> — carga datos financieros (Playa)\n" +
          "/fecha <número> <inicio:YYYY-MM-DD> <objetivo:YYYY-MM-DD> — carga fechas de un proyecto\n" +
          "/cotizacion <número> — carga un desglose de cotización (envía el comando solo para ver el formato)"
        : "")
  )
);

bot.command("resumen", (ctx) => ctx.reply(resumenText(), { parse_mode: "Markdown" }));

bot.action("resumen", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply(resumenText(), { parse_mode: "Markdown" });
});

bot.command("proyectos", (ctx) => {
  ctx.reply("Selecciona un proyecto:", projectsKeyboard(getCategoryProjects("cdp")));
});

bot.action("listar", async (ctx) => {
  await ctx.answerCbQuery();
  const keyboard = projectsKeyboard(getCategoryProjects("cdp"));
  ctx
    .editMessageText("Selecciona un proyecto:", keyboard)
    .catch(() => ctx.reply("Selecciona un proyecto:", keyboard));
});

bot.command("playa", (ctx) => {
  ctx.reply("🏖️ Propiedades de la Playa — selecciona un sub-proyecto:", projectsKeyboard(getCategoryProjects("playa")));
});

bot.action("listar_playa", async (ctx) => {
  await ctx.answerCbQuery();
  const keyboard = projectsKeyboard(getCategoryProjects("playa"));
  ctx
    .editMessageText("🏖️ Propiedades de la Playa — selecciona un sub-proyecto:", keyboard)
    .catch(() => ctx.reply("🏖️ Propiedades de la Playa — selecciona un sub-proyecto:", keyboard));
});

bot.action(/^ver_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const idx = Number(ctx.match[1]);
  const projects = getProjects();
  const project = projects[idx];
  if (!project) return ctx.reply("Proyecto no encontrado.");
  const keyboard = detailKeyboard(idx, isAdmin(ctx.from.id), backActionFor(project));
  ctx
    .editMessageText(formatProject(project, idx + 1), { parse_mode: "Markdown", ...keyboard })
    .catch(() => ctx.reply(formatProject(project, idx + 1), { parse_mode: "Markdown", ...keyboard }));
});

bot.action(/^bump_(\d+)_(-?\d+)$/, async (ctx) => {
  const idx = Number(ctx.match[1]);
  const delta = Number(ctx.match[2]);
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Solo administradores.", { show_alert: true });

  const projects = getProjects();
  const current = projects[idx];
  if (!current) return ctx.answerCbQuery("Proyecto no encontrado.");

  const nuevoAvance = Math.min(100, Math.max(0, current.progress + delta));
  const { project, before } = updateProject(idx, { progress: nuevoAvance });
  await ctx.answerCbQuery(`Avance: ${project.progress}%`);

  const keyboard = detailKeyboard(idx, true, backActionFor(project));
  ctx
    .editMessageText(formatProject(project, idx + 1), { parse_mode: "Markdown", ...keyboard })
    .catch(() => ctx.reply(formatProject(project, idx + 1), { parse_mode: "Markdown", ...keyboard }));
  notifyUpdate(ctx, project, before);
});

bot.action(/^estado_(\d+)_(progress|active|won|lost)$/, async (ctx) => {
  const idx = Number(ctx.match[1]);
  const nuevoEstado = ctx.match[2];
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Solo administradores.", { show_alert: true });

  const projects = getProjects();
  if (!projects[idx]) return ctx.answerCbQuery("Proyecto no encontrado.");

  const { project, before } = updateProject(idx, { status: nuevoEstado });
  await ctx.answerCbQuery(`Estado: ${STATUS[project.status].label}`);

  const keyboard = detailKeyboard(idx, true, backActionFor(project));
  ctx
    .editMessageText(formatProject(project, idx + 1), { parse_mode: "Markdown", ...keyboard })
    .catch(() => ctx.reply(formatProject(project, idx + 1), { parse_mode: "Markdown", ...keyboard }));
  notifyUpdate(ctx, project, before);
});

bot.command("inversion", (ctx) => ctx.reply(inversionText(), { parse_mode: "Markdown" }));

bot.action("inversion", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply(inversionText(), { parse_mode: "Markdown" });
});

bot.command("cronograma", (ctx) => {
  const arg = ctx.message.text.split(" ").slice(1).join(" ").trim().toLowerCase();
  const category = arg === "playa" ? "playa" : "cdp";
  ctx.reply(cronogramaText(category), { parse_mode: "Markdown" });
});

bot.action("cronograma", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply(cronogramaText("cdp"), { parse_mode: "Markdown" });
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
  if (!requireAdmin(ctx)) return;

  const args = ctx.message.text.split(" ").slice(1);
  const [numStr, avanceStr, estadoStr] = args;
  const projects = getProjects();
  const idx = parseInt(numStr, 10) - 1;
  const avance = parseInt(avanceStr, 10);
  const estado = estadoStr ? ESTADOS[estadoStr.toLowerCase()] : undefined;

  if (!Number.isInteger(idx) || idx < 0 || idx >= projects.length) {
    return ctx.reply(`Uso: /actualizar <número> <avance 0-100> [progreso|activo|ganado|perdido]\n(número entre 1 y ${projects.length})`);
  }
  if (!Number.isInteger(avance) || avance < 0 || avance > 100) {
    return ctx.reply("El avance debe ser un número entre 0 y 100.");
  }
  if (estadoStr && !estado) {
    return ctx.reply("Estado inválido. Usa: progreso | activo | ganado.");
  }

  const { project, before } = updateProject(idx, { progress: avance, status: estado });

  await ctx.reply(`✅ Actualizado: *${project.title}*`, { parse_mode: "Markdown" });
  notifyUpdate(ctx, project, before);
});

bot.command("nuevo", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = ctx.message.text.split(" ").slice(1).join(" ");
  const parts = raw.split("|").map((s) => s.trim());
  const [title, client, avanceStr, estadoStr, nextStep] = parts;
  const avance = parseInt(avanceStr, 10);
  const estado = estadoStr ? ESTADOS[estadoStr.toLowerCase()] : undefined;

  if (!title || !client || !avanceStr || !estadoStr) {
    return ctx.reply(
      "Uso: /nuevo Título | Cliente | avance | progreso|activo|ganado|perdido | próximo paso (opcional)\n" +
        "Ejemplo: /nuevo Renovación de contrato | ACME | 20 | progreso | Enviar propuesta inicial"
    );
  }
  if (!Number.isInteger(avance) || avance < 0 || avance > 100) {
    return ctx.reply("El avance debe ser un número entre 0 y 100.");
  }
  if (!estado) {
    return ctx.reply("Estado inválido. Usa: progreso | activo | ganado.");
  }

  const { project, index } = addProject({ title, client, progress: avance, status: estado, nextStep });

  await ctx.reply(`✅ Proyecto #${index + 1} creado:\n\n${formatProject(project, index + 1)}`, {
    parse_mode: "Markdown",
  });

  if (notifyChatId) {
    bot.telegram
      .sendMessage(notifyChatId, `🆕 *Nuevo proyecto*\n\n${formatProject(project, index + 1)}`, {
        parse_mode: "Markdown",
      })
      .catch((err) => console.error("No se pudo enviar la notificación:", err.message));
  }
});

bot.command("nota", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.message.text.split(" ").slice(1);
  const numStr = args[0];
  const texto = args.slice(1).join(" ").trim();
  const projects = getProjects();
  const idx = parseInt(numStr, 10) - 1;

  if (!Number.isInteger(idx) || idx < 0 || idx >= projects.length || !texto) {
    return ctx.reply(
      `Uso: /nota <número> <texto>\nEjemplo: /nota 3 Cliente confirmó reunión para el lunes.\n(número entre 1 y ${projects.length})`
    );
  }

  const { project } = updateProject(idx, { nextStep: texto });
  ctx.reply(`✅ Próximo paso actualizado:\n\n${formatProject(project, idx + 1)}`, { parse_mode: "Markdown" });
});

bot.command("finanzas", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = ctx.message.text.split(" ").slice(1).join(" ");
  const parts = raw.split("|").map((s) => s.trim());
  const [numStr, investment, roi, payback] = parts;
  const projects = getProjects();
  const idx = parseInt(numStr, 10) - 1;

  if (!Number.isInteger(idx) || idx < 0 || idx >= projects.length || !investment) {
    return ctx.reply(
      `Uso: /finanzas <número> | <inversión> | <ROI> | <payback opcional>\n` +
        "Ejemplo: /finanzas 8 | $154,000 | ~50%/año | ~2.0 años\n" +
        `(número entre 1 y ${projects.length})`
    );
  }

  const project = setFinancials(idx, { investment, roi, payback });
  ctx.reply(`✅ Datos financieros actualizados:\n\n${formatInvestmentLine(project, idx + 1)}`, { parse_mode: "Markdown" });
});

bot.command("fecha", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.message.text.split(" ").slice(1);
  const [numStr, startDate, targetDate] = args;
  const projects = getProjects();
  const idx = parseInt(numStr, 10) - 1;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!Number.isInteger(idx) || idx < 0 || idx >= projects.length || !startDate || !targetDate) {
    return ctx.reply(
      `Uso: /fecha <número> <inicio:YYYY-MM-DD> <objetivo:YYYY-MM-DD>\n` +
        "Ejemplo: /fecha 1 2026-06-01 2026-09-30\n" +
        `(número entre 1 y ${projects.length})`
    );
  }
  if (!dateRegex.test(startDate) || !dateRegex.test(targetDate)) {
    return ctx.reply("Las fechas deben tener formato YYYY-MM-DD, ej. 2026-09-30.");
  }

  const project = setDates(idx, { startDate, targetDate });
  ctx.reply(`✅ Fechas actualizadas:\n\n${formatTimelineLine(project, idx + 1)}`, { parse_mode: "Markdown" });
});

const COTIZACION_USAGE =
  "Uso:\n" +
  "/cotizacion <número>\n" +
  "<título>\n" +
  "<cant>|<descripción>|<precio unit>|<total>\n" +
  "... (una línea por partida)\n" +
  "--- (opcional, separa la nota al pie)\n" +
  "<nota>\n\n" +
  "Para una fila de subtotal/total deja cant y precio unit vacíos: |Total Año 1||3594.60\n\n" +
  "Ejemplo:\n" +
  "/cotizacion 2\n" +
  "Cotización interna — 20 equipos\n" +
  "1|Licencia GAV Tracking 10 equipos, 1 año de manto|2798.37|2798.37\n" +
  "10|Dispositivo extra (equipos 11–20), 1 año de manto|79.62|796.24\n" +
  "|Total Año 1 (licencia + soporte)||3594.60\n" +
  "---\n" +
  "Fuente: cotización de Grupo GAV a CDP Digital.\n\n" +
  "/cotizacion <número> borrar — elimina la cotización cargada.";

bot.command("cotizacion", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const lines = ctx.message.text.split("\n");
  const numStr = lines[0].split(" ")[1];
  const projects = getProjects();
  const idx = parseInt(numStr, 10) - 1;

  if (!Number.isInteger(idx) || idx < 0 || idx >= projects.length) {
    return ctx.reply(`${COTIZACION_USAGE}\n\n(número entre 1 y ${projects.length})`);
  }

  const body = lines.slice(1).map((l) => l.trim());
  const bodyText = body.join(" ").trim().toLowerCase();
  if (bodyText === "borrar" || bodyText === "eliminar") {
    const project = setQuote(idx, null);
    return ctx.reply(`✅ Cotización eliminada de *${project.title}*.`, { parse_mode: "Markdown" });
  }

  const nonEmptyBody = body.filter(Boolean);
  const quote = nonEmptyBody.length ? parseQuoteBody(nonEmptyBody) : null;
  if (!quote || !quote.items.length) {
    return ctx.reply(COTIZACION_USAGE);
  }

  const project = setQuote(idx, quote);
  ctx.reply(`✅ Cotización actualizada para *${project.title}*:\n\n${formatQuoteText(project.quote)}`, {
    parse_mode: "Markdown",
  });
});

bot.launch();
console.log("Bot de Telegram iniciado.");

// Si Railway (u otro host) asigna un puerto público, levanta también la API
// de solo lectura que alimenta el dashboard en vivo. Sin PORT, el bot sigue
// funcionando igual que antes (solo long polling, sin servidor HTTP).
if (process.env.PORT) {
  const { startServer } = require("./server");
  startServer(process.env.PORT);
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
