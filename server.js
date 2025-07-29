import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Client, LocalAuth } from 'whatsapp-web.js'
import qrcode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)
const PORT = process.env.PORT || 3000

const HISTORY_DIR = path.join(__dirname, 'history')
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR)

let clients = {}

app.use(express.static(path.join(__dirname, 'public')))

function saveHistory(socketId, action, total, deleted) {
  const log = {
    date: new Date().toISOString(),
    action,
    totalMessages: total,
    deletedMessages: deleted
  }

  const filepath = path.join(HISTORY_DIR, `${socketId}.json`)
  let history = []
  if (fs.existsSync(filepath)) {
    history = JSON.parse(fs.readFileSync(filepath))
  }
  history.push(log)
  fs.writeFileSync(filepath, JSON.stringify(history, null, 2))
}

io.on('connection', (socket) => {
  console.log(`🔌 Usuario conectado: ${socket.id}`)

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: socket.id }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
  })

  clients[socket.id] = client

  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr)
    socket.emit('qr', qrImage)
  })

  client.on('ready', () => {
    socket.emit('ready')
    console.log(`✅ Cliente listo: ${socket.id}`)
  })

  socket.on('clear-all', async () => {
    const chats = await client.getChats()
    let totalDeleted = 0
    let totalMsgs = 0

    for (let chat of chats) {
      const msgs = await chat.fetchMessages({ limit: 1000 }).catch(() => [])
      totalMsgs += msgs.length
      await chat.clearMessages().catch(() => {})
      await chat.delete().catch(() => {})
      totalDeleted += msgs.length
    }

    socket.emit('done', {
      action: 'Todos los chats eliminados',
      total: totalMsgs,
      deleted: totalDeleted
    })

    saveHistory(socket.id, 'Todos los chats eliminados', totalMsgs, totalDeleted)
  })

  socket.on('clear-inactive', async () => {
    const chats = await client.getChats()
    const now = new Date()
    let totalDeleted = 0
    let totalMsgs = 0

    for (let chat of chats) {
      const msgs = await chat.fetchMessages({ limit: 1 }).catch(() => [])
      const lastMsg = msgs[0]
      if (lastMsg) {
        const lastDate = lastMsg.timestamp * 1000
        const diff = now - new Date(lastDate)
        if (diff > 8 * 24 * 60 * 60 * 1000) {
          const allMsgs = await chat.fetchMessages({ limit: 1000 }).catch(() => [])
          totalMsgs += allMsgs.length
          await chat.clearMessages().catch(() => {})
          await chat.delete().catch(() => {})
          totalDeleted += allMsgs.length
        }
      }
    }

    socket.emit('done', {
      action: 'Chats inactivos eliminados',
      total: totalMsgs,
      deleted: totalDeleted
    })

    saveHistory(socket.id, 'Chats inactivos eliminados', totalMsgs, totalDeleted)
  })

  socket.on('clear-groups', async () => {
    const chats = await client.getChats()
    let totalDeleted = 0
    let totalMsgs = 0

    for (let chat of chats) {
      if (chat.isGroup) {
        const msgs = await chat.fetchMessages({ limit: 1000 }).catch(() => [])
        totalMsgs += msgs.length
        await chat.clearMessages().catch(() => {})
        await chat.delete().catch(() => {})
        totalDeleted += msgs.length
      }
    }

    socket.emit('done', {
      action: 'Grupos eliminados',
      total: totalMsgs,
      deleted: totalDeleted
    })

    saveHistory(socket.id, 'Grupos eliminados', totalMsgs, totalDeleted)
  })

  socket.on('disconnect', () => {
    console.log(`❌ Usuario desconectado: ${socket.id}`)
    if (clients[socket.id]) {
      clients[socket.id].destroy()
      delete clients[socket.id]
    }
  })
})

// Descargar historial como archivo
app.get('/history/:id', (req, res) => {
  const file = path.join(HISTORY_DIR, `${req.params.id}.json`)
  if (fs.existsSync(file)) {
    res.download(file, `whatsapp-history-${req.params.id}.json`)
  } else {
    res.status(404).send('Historial no encontrado')
  }
})

// Ver historial en la tabla
app.get('/history-view/:id', (req, res) => {
  const file = path.join(HISTORY_DIR, `${req.params.id}.json`)
  if (fs.existsSync(file)) {
    const content = JSON.parse(fs.readFileSync(file))
    res.json(content)
  } else {
    res.json([])
  }
})

httpServer.listen(PORT, () => {
  console.log('🟢 Servidor escuchando en el puerto', PORT)
})
