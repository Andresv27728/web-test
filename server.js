import { Client, LocalAuth } from 'whatsapp-web.js';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', async (socket) => {
  console.log(`📲 Cliente conectado: ${socket.id}`);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: socket.id }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    }
  });

  client.on('qr', (qr) => {
    socket.emit('qr', qr);
  });

  client.on('ready', () => {
    socket.emit('ready');
  });

  await client.initialize();
});

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(process.env.PORT || 3000, () => {
  console.log('✅ Servidor iniciado en el puerto 3000');
});
