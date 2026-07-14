const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'projects.json');

function loadProjects() {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

function buildProgressBar(progress) {
  const filled = Math.round(progress / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

function buildUpdateMessage() {
  const data = loadProjects();
  const lines = [];
  lines.push('📊 *Actualización de Proyectos — CDP Digital*');
  lines.push(`_Actualizado: ${data.updatedAt}_`);
  lines.push('');

  data.projects.forEach((project, index) => {
    lines.push(`*${index + 1}. ${project.title}*`);
    lines.push(`Cliente: ${project.client}`);
    lines.push(`Estado: ${project.status}`);
    lines.push(`${buildProgressBar(project.progress)} ${project.progress}%`);
    lines.push(`📌 Próximo paso: ${project.nextStep}`);
    lines.push('');
  });

  lines.push('_Enviado automáticamente desde el dashboard de CDP Digital_');
  return lines.join('\n');
}

module.exports = { loadProjects, buildUpdateMessage };
