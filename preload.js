// preload.js

// Todas las APIs de Node.js están disponibles en el proceso de precarga.
// Tiene el mismo sandbox que una extensión de Chrome.
window.addEventListener('DOMContentLoaded', () => {
  // Podríamos exponer APIs de forma segura al proceso de renderizado aquí
  // usando `contextBridge`. Por ahora, lo mantenemos simple.
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

// Para este proyecto, como deshabilitamos `contextIsolation`, no es estrictamente
// necesario, pero es una buena práctica de seguridad en Electron.
// Si `contextIsolation: true`, necesitarías exponer `ipcRenderer` así:
/*
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
})
*/

