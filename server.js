const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', async (qr) => {
  const qrImageUrl = await qrcode.toDataURL(qr);
  io.emit('qr', qrImageUrl);
});

client.on('ready', () => {
  console.log('✅ Cliente conectado');
  io.emit('ready');
});

// Función para limpiar todos los chats
async function clearAllChats() {
  const chats = await client.getChats();
  let total = 0;
  let eliminados = 0;
  for (let chat of chats) {
    const messages = await chat.fetchMessages({ limit: 100 });
    total += messages.length;
    for (let msg of messages) {
      try {
        await msg.delete(true);
        eliminados++;
      } catch {}
    }
  }
  return { total, eliminados };
}

// Limpiar chats inactivos por más de 8 días
async function clearInactiveChats() {
  const chats = await client.getChats();
  const now = Date.now();
  let total = 0;
  let eliminados = 0;

  for (let chat of chats) {
    const messages = await chat.fetchMessages({ limit: 1 });
    const last = messages[0];
    if (last && now - last.timestamp * 1000 > 8 * 24 * 60 * 60 * 1000) {
      total++;
      try {
        await client.deleteChat(chat.id._serialized);
        eliminados++;
      } catch {}
    }
  }
  return { total, eliminados };
}

// Eliminar todos los grupos
async function clearGroupChats() {
  const chats = await client.getChats();
  let total = 0;
  let eliminados = 0;

  for (let chat of chats) {
    if (chat.isGroup) {
      total++;
      try {
        await client.deleteChat(chat.id._serialized);
        eliminados++;
      } catch {}
    }
  }

  return { total, eliminados };
}

io.on('connection', socket => {
  console.log('🧩 Cliente web conectado');

  socket.on('cleanAll', async () => {
    const res = await clearAllChats();
    socket.emit('actionResult', { action: 'Limpiar todo', ...res });
  });

  socket.on('cleanInactive', async () => {
    const res = await clearInactiveChats();
    socket.emit('actionResult', { action: 'Limpiar inactivos', ...res });
  });

  socket.on('cleanGroups', async () => {
    const res = await clearGroupChats();
    socket.emit('actionResult', { action: 'Eliminar grupos', ...res });
  });
});

client.initialize();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
