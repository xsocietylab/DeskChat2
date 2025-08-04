// preload.js
const { contextBridge, ipcRenderer } = require('electron')

// Exponer APIs de forma segura al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  // Enviar mensajes al proceso principal
  send: (channel, data) => {
    // Lista de canales permitidos
    const validChannels = ['user:ready', 'message:send']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  
  // Recibir mensajes del proceso principal
  on: (channel, func) => {
    // Lista de canales permitidos para recibir
    const validChannels = ['users:update', 'message:receive']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },
  
  // Remover listeners
  removeAllListeners: (channel) => {
    const validChannels = ['users:update', 'message:receive']
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel)
    }
  }
})

// Información de versiones (opcional)
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

