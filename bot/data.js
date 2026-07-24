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

function updateProject(index, { progress, status, nextStep }) {
  const projects = getProjects();
  const project = projects[index];
  if (!project) throw new Error("Proyecto no encontrado");
  const before = { progress: project.progress, status: project.status, nextStep: project.nextStep };
  if (progress !== undefined) project.progress = progress;
  if (status !== undefined) {
    project.status = status;
    project.badge = STATUS[status].label;
  }
  if (nextStep !== undefined) project.nextStep = nextStep;
  saveProjects(projects);
  return { project, before };
}

function addProject({ title, client, progress, status, badge, nextStep }) {
  const projects = getProjects();
  const project = {
    title,
    client,
    status,
    badge: badge || STATUS[status].label,
    progress,
    nextStep: nextStep || "Por definir.",
  };
  projects.push(project);
  saveProjects(projects);
  return { project, index: projects.length - 1 };
}

module.exports = { STATUS, getProjects, getMetrics, updateProject, addProject };
