// Servidor HTTP de solo lectura para que el dashboard (index.html) consuma
// los datos en vivo del bot, en vez de mantenerlos hardcodeados por separado.
const express = require("express");
const cors = require("cors");
const { getCategoryProjects, getMetrics } = require("./data");

function publicProject({ project }) {
  const { title, client, category, status, badge, progress, nextStep } = project;
  return { title, client, category, status, badge, progress, nextStep };
}

function startServer(port) {
  const app = express();
  app.use(cors());

  // Solo expone la categoría "cdp": los proyectos "playa" son personales y
  // nunca deben salir del bot de Telegram.
  app.get("/api/dashboard", (_req, res) => {
    res.json({
      metrics: getMetrics("cdp"),
      projects: getCategoryProjects("cdp").map(publicProject),
      updatedAt: new Date().toISOString(),
    });
  });

  app.get("/health", (_req, res) => res.send("ok"));

  app.listen(port, () => {
    console.log(`API del dashboard escuchando en el puerto ${port}`);
  });
}

module.exports = { startServer };
