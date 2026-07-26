// Datos reflejados en index.html (dashboard CDP Digital).
// state.seed.json (versionado en git) es la carga inicial. El estado vivo se
// guarda aparte, en DATA_DIR, para sobrevivir a los redeploys — ver README.

const fs = require("fs");
const path = require("path");

const SEED_FILE = path.join(__dirname, "state.seed.json");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, ".data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

function ensureStateFile() {
  if (fs.existsSync(STATE_FILE)) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.copyFileSync(SEED_FILE, STATE_FILE);
}

ensureStateFile();

const STATUS = {
  progress: { emoji: "🟠", label: "En proceso" },
  active: { emoji: "🔵", label: "Activo / listo" },
  won: { emoji: "🟢", label: "Cerrado — Ganado" },
  lost: { emoji: "🔴", label: "Cerrado — No aceptado" },
};

function getProjects() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveProjects(projects) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(projects, null, 2) + "\n");
}

function getCategoryProjects(category) {
  return getProjects()
    .map((project, index) => ({ project, index }))
    .filter(({ project }) => (project.category || "cdp") === category);
}

function getMetrics(category = "cdp") {
  const projects = getProjects().filter((p) => (p.category || "cdp") === category);
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

function addProject({ title, client, progress, status, badge, nextStep, category = "cdp" }) {
  const projects = getProjects();
  const project = {
    title,
    client,
    category,
    status,
    badge: badge || STATUS[status].label,
    progress,
    nextStep: nextStep || "Por definir.",
  };
  projects.push(project);
  saveProjects(projects);
  return { project, index: projects.length - 1 };
}

module.exports = { STATUS, getProjects, getCategoryProjects, getMetrics, updateProject, addProject };
