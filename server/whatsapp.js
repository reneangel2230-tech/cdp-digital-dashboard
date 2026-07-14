const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const state = {
  status: 'INITIALIZING', // INITIALIZING | QR | READY | DISCONNECTED
  qrDataUrl: null,
};

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: process.env.WWEBJS_AUTH_PATH || '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', async (qr) => {
  state.status = 'QR';
  state.qrDataUrl = await qrcode.toDataURL(qr);
  console.log('Nuevo código QR generado. Visita /qr para escanearlo.');
});

client.on('ready', () => {
  state.status = 'READY';
  state.qrDataUrl = null;
  console.log('Cliente de WhatsApp conectado y listo.');
});

client.on('disconnected', (reason) => {
  state.status = 'DISCONNECTED';
  console.log('Cliente de WhatsApp desconectado:', reason);
  client.initialize();
});

client.on('auth_failure', (msg) => {
  console.error('Fallo de autenticación de WhatsApp:', msg);
});

function initialize() {
  client.initialize();
}

async function listGroups() {
  const chats = await client.getChats();
  return chats
    .filter((chat) => chat.isGroup)
    .map((chat) => ({ id: chat.id._serialized, name: chat.name }));
}

async function sendToGroups(groupIds, message) {
  const results = [];
  for (const groupId of groupIds) {
    try {
      await client.sendMessage(groupId, message);
      results.push({ groupId, ok: true });
    } catch (err) {
      results.push({ groupId, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = { client, state, initialize, listGroups, sendToGroups };
