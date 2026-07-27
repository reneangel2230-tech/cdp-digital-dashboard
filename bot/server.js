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

  // "metrics"/"projects" son solo de la categoría "cdp" (el negocio). "playa"
  // se expone aparte, sin mezclarse en esas métricas, para la sección
  // personal del dashboard — a pedido explícito del dueño de los datos.
  app.get("/api/dashboard", (_req, res) => {
    res.json({
      metrics: getMetrics("cdp"),
      projects: getCategoryProjects("cdp").map(publicProject),
      playa: getCategoryProjects("playa").map(publicProject),
      updatedAt: new Date().toISOString(),
    });
  });

  app.get("/health", (_req, res) => res.send("ok"));

  app.listen(port, () => {
    console.log(`API del dashboard escuchando en el puerto ${port}`);
  });
}

module.exports = { startServer };
