// Datos reflejados en index.html (dashboard CDP Digital).
// El estado vivo se guarda en state.json y se actualiza vía /actualizar.

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "state.json");

const STATUS = {
  progress: { emoji: "🟠", label: "En proceso" },
  active: { emoji: "🔵", label: "Activo / listo" },
  won: { emoji: "🟢", label: "Cerrado — Ganado" },
};

function getProjects() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveProjects(projects) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(projects, null, 2) + "\n");
}

function getMetrics() {
  const projects = getProjects();
  return {
    proyectosActivos: projects.length,
    enProcesoCotizacion: projects.filter((p) => p.status === "progress").length,
    clientesInvolucrados: new Set(projects.map((p) => p.client)).size,
  };
}

function updateProject(index, { progress, status }) {
  const projects = getProjects();
  const project = projects[index];
  if (!project) throw new Error("Proyecto no encontrado");
  const before = { progress: project.progress, status: project.status };
  if (progress !== undefined) project.progress = progress;
  if (status !== undefined) project.status = status;
  saveProjects(projects);
  return { project, before };
}

module.exports = { STATUS, getProjects, getMetrics, updateProject };
