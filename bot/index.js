require("dotenv").config();
const { Telegraf } = require("telegraf");
const { STATUS, projects, metrics } = require("./data");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN. Configúralo en el archivo .env");
  process.exit(1);
}

const bot = new Telegraf(token);

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

bot.start((ctx) =>
  ctx.reply(
    "👋 Hola, soy el bot de *CDP Digital*.\n\n" +
      "Puedo darte el estado de los proyectos del dashboard.\n\n" +
      "Comandos disponibles:\n" +
      "/resumen — métricas generales\n" +
      "/proyectos — lista de todos los proyectos\n" +
      "/proyecto <número> — detalle de un proyecto",
    { parse_mode: "Markdown" }
  )
);

bot.help((ctx) =>
  ctx.reply(
    "Comandos disponibles:\n" +
      "/resumen — métricas generales\n" +
      "/proyectos — lista de todos los proyectos\n" +
      "/proyecto <número> — detalle de un proyecto (usa el número de /proyectos)"
  )
);

bot.command("resumen", (ctx) => {
  const message =
    `📊 *Resumen — actualizado el ${metrics.actualizado}*\n\n` +
    `🚀 Proyectos activos: *${metrics.proyectosActivos}*\n` +
    `📄 En proceso de cotización: *${metrics.enProcesoCotizacion}*\n` +
    `🤝 Clientes involucrados: *${metrics.clientesInvolucrados}*`;
  ctx.reply(message, { parse_mode: "Markdown" });
});

bot.command("proyectos", (ctx) => {
  const message = projects.map((p, i) => formatProject(p, i + 1)).join("\n\n");
  ctx.reply(message, { parse_mode: "Markdown" });
});

bot.command("proyecto", (ctx) => {
  const arg = ctx.message.text.split(" ").slice(1).join(" ").trim();
  if (!arg) {
    return ctx.reply("Uso: /proyecto <número>\nEjemplo: /proyecto 1\n\nUsa /proyectos para ver la lista numerada.");
  }
  const idx = parseInt(arg, 10);
  if (!Number.isInteger(idx) || idx < 1 || idx > projects.length) {
    return ctx.reply(`Número inválido. Usa un valor entre 1 y ${projects.length} (ver /proyectos).`);
  }
  ctx.reply(formatProject(projects[idx - 1], idx), { parse_mode: "Markdown" });
});

bot.launch();
console.log("Bot de Telegram iniciado.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
