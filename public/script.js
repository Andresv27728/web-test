const socket = io()
const qrContainer = document.getElementById('qr')
const controls = document.getElementById('controls')
const status = document.getElementById('status')

socket.on('qr', (qr) => {
  qrContainer.innerHTML = `<img src="${qr}" />`
})

socket.on('ready', () => {
  qrContainer.innerHTML = `<p>✅ Sesión iniciada con éxito</p>`
  controls.style.display = 'block'
  fetchHistory()
})

socket.on('done', ({ action, total, deleted }) => {
  document.getElementById('total').innerText = total
  document.getElementById('deleted').innerText = deleted
  document.getElementById('lastaction').innerText = action
  status.innerText = `✅ ${action}`
  fetchHistory()
})

function clearAll() {
  socket.emit('clear-all')
}

function clearInactive() {
  socket.emit('clear-inactive')
}

function clearGroups() {
  socket.emit('clear-groups')
}

function downloadHistory() {
  const link = document.createElement('a')
  link.href = `/history/${socket.id}`
  link.download = `whatsapp-history.json`
  link.click()
}

function fetchHistory() {
  fetch(`/history-view/${socket.id}`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.querySelector('#history-table tbody')
      tbody.innerHTML = ''
      for (let row of data) {
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td>${new Date(row.date).toLocaleString()}</td>
          <td>${row.action}</td>
          <td>${row.totalMessages}</td>
          <td>${row.deletedMessages}</td>
        `
        tbody.appendChild(tr)
      }
    })
}
