// Datos reflejados en index.html (dashboard CDP Digital)
// Mantener sincronizado manualmente con el dashboard si este cambia.

const STATUS = {
  progress: { emoji: "🟠", label: "En proceso" },
  active: { emoji: "🔵", label: "Activo / listo" },
  won: { emoji: "🟢", label: "Cerrado — Ganado" },
};

const projects = [
  {
    title: "Cambio de flota de impresión",
    client: "Tzanetatos",
    status: "progress",
    badge: "Cotización en proceso",
    progress: 55,
    nextStep:
      "Revisar la cotización recibida del proveedor (opciones nube y on-premise) y consolidar la propuesta para pasar a comercial.",
  },
  {
    title: "GavaTracking",
    client: "Super Baru",
    status: "active",
    badge: "Cotización elaborada",
    progress: 60,
    nextStep:
      "Gestionar internamente el envío de la cotización y el brochure ya elaborados al cliente.",
  },
  {
    title: "Convenio Marco — Arrendamiento de Impresoras",
    client: "Sector Público (Licitación)",
    status: "progress",
    badge: "En evaluación",
    progress: 55,
    nextStep: "Dar seguimiento al resultado de la evaluación/adjudicación de la licitación.",
  },
  {
    title: "Migración de sistema de impresión a nuevo servidor",
    client: "EPA",
    status: "progress",
    badge: "En coordinación",
    progress: 45,
    nextStep:
      "Reunión de coordinación agendada con el cliente para definir el plan de migración; confirmar responsable interno del proyecto.",
  },
  {
    title: "Suministro de equipos (licitación ganada)",
    client: "Cervecería Nacional",
    status: "won",
    badge: "Cerrado — Ganado",
    progress: 92,
    nextStep: "El pedido ya está en proceso de compra hacia fábrica; dar seguimiento a la fecha de entrega definitiva.",
  },
  {
    title: "Nuevas oportunidades — Clientes de Gobierno",
    client: "Sector Público (CSS, Órgano Judicial, Contraloría, Ministerio de Gobierno y Justicia)",
    status: "progress",
    badge: "Recopilando información",
    progress: 15,
    nextStep:
      "Recopilar por entidad el proveedor actual, equipos contratados y vencimiento de arrendamientos, para preparar un nuevo pliego.",
  },
  {
    title: "Nueva oportunidad — Suministros de impresión",
    client: "Novartis",
    status: "progress",
    badge: "Identificando alcance",
    progress: 15,
    nextStep: "Identificar los artículos y el proveedor correspondiente para preparar la cotización.",
  },
];

const metrics = {
  proyectosActivos: 7,
  enProcesoCotizacion: 5,
  clientesInvolucrados: 7,
  actualizado: "17 de julio de 2026",
};

module.exports = { STATUS, projects, metrics };
