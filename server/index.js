require('dotenv').config();
const express = require('express');
const cors = require('cors');

const wa = require('./whatsapp');
const { buildUpdateMessage } = require('./message');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SEND_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DEFAULT_GROUP_IDS = (process.env.WHATSAPP_GROUP_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

if (!API_KEY) {
  console.warn('ADVERTENCIA: SEND_API_KEY no está configurada. Define una en .env antes de exponer el servicio.');
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

function requireApiKey(req, res, next) {
  const provided = req.header('X-API-Key');
  if (!API_KEY || provided !== API_KEY) {
    return res.status(401).json({ error: 'API key inválida o ausente' });
  }
  next();
}

app.get('/status', (req, res) => {
  res.json({ status: wa.state.status });
});

app.get('/qr', (req, res) => {
  if (wa.state.status === 'READY') {
    return res.status(200).send('<h2>La sesión de WhatsApp ya está conectada.</h2>');
  }
  if (!wa.state.qrDataUrl) {
    return res.status(202).send('<h2>Generando código QR, recarga en unos segundos...</h2>');
  }
  res.send(`
    <html>
      <body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;">
        <h2>Escanea este código con WhatsApp (Dispositivos vinculados)</h2>
        <img src="${wa.state.qrDataUrl}" style="width:320px;height:320px;" />
      </body>
    </html>
  `);
});

app.get('/groups', requireApiKey, async (req, res) => {
  if (wa.state.status !== 'READY') {
    return res.status(409).json({ error: 'El cliente de WhatsApp aún no está conectado' });
  }
  try {
    const groups = await wa.listGroups();
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/send-update', requireApiKey, async (req, res) => {
  if (wa.state.status !== 'READY') {
    return res.status(409).json({ error: 'El cliente de WhatsApp aún no está conectado' });
  }

  const groupIds = Array.isArray(req.body?.groupIds) && req.body.groupIds.length
    ? req.body.groupIds
    : DEFAULT_GROUP_IDS;

  if (!groupIds.length) {
    return res.status(400).json({ error: 'No hay grupos configurados. Define WHATSAPP_GROUP_IDS o envía groupIds en el body.' });
  }

  try {
    const message = buildUpdateMessage();
    const results = await wa.sendToGroups(groupIds, message);
    res.json({ message, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor CDP WhatsApp Notifier escuchando en el puerto ${PORT}`);
  wa.initialize();
});
