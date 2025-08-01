// main.js - Proceso principal de Electron

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dgram = require('dgram');
const net = require('net');
const os = require('os');

// --- Constantes de Red ---
const DISCOVERY_PORT = 33333; // Puerto para descubrimiento UDP
const MESSAGE_PORT = 33334;   // Puerto base para mensajería TCP
const BROADCAST_ADDRESS = '255.255.255.255';
const DISCOVERY_INTERVAL = 5000; // 5 segundos
const USER_TIMEOUT = 15000; // 15 segundos

// --- Variables Globales ---
let mainWindow;
let udpSocket;
let tcpServer;
let userInfo = {
    id: generateUniqueId(),
    username: 'Desconocido',
    ip: getLocalIp(),
    port: MESSAGE_PORT
};
let connectedUsers = new Map(); // Almacena los usuarios conectados

// --- Funciones de Utilidad ---

// Genera un ID único para el usuario
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 15);
}

// Obtiene la dirección IP local (no-interna)
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}


// --- Lógica de la Aplicación ---

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Necesario para usar `require` en el renderer
            preload: path.join(__dirname, 'preload.js') // Opcional, pero buena práctica
        },
        title: 'DeskChat',
        backgroundColor: '#1a1a1a',
        show: false // No mostrar hasta que esté lista
    });

    // Cargar el HTML principal. En este caso, es el mismo archivo.
    // Para un proyecto real, separarías main.js del HTML.
    // Aquí asumimos que este archivo se llama `main.js` y el HTML `index.html`.
    mainWindow.loadFile('index.html'); 

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}


// --- Lógica de Red ---

// 1. Descubrimiento (UDP)
function startDiscovery() {
    udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    udpSocket.on('listening', () => {
        const address = udpSocket.address();
        console.log(`Socket UDP escuchando en ${address.address}:${address.port}`);
        udpSocket.setBroadcast(true);
        // Empezar a anunciar nuestra presencia
        setInterval(broadcastPresence, DISCOVERY_INTERVAL);
    });

    udpSocket.on('message', (message, rinfo) => {
        // Ignorar mensajes propios
        if (rinfo.address === userInfo.ip) return;

        try {
            const user = JSON.parse(message.toString());
            // Añadir o actualizar usuario en el mapa
            user.lastSeen = Date.now();
            connectedUsers.set(user.id, user);
            updateUserList();
        } catch (error) {
            console.error('Error al parsear mensaje de descubrimiento:', error);
        }
    });

    udpSocket.bind(DISCOVERY_PORT);

    // Revisar periódicamente si hay usuarios inactivos
    setInterval(checkInactiveUsers, USER_TIMEOUT / 2);
}

// Anuncia la presencia en la red
function broadcastPresence() {
    const message = Buffer.from(JSON.stringify(userInfo));
    udpSocket.send(message, 0, message.length, DISCOVERY_PORT, BROADCAST_ADDRESS, (err) => {
        if (err) console.error('Error al enviar broadcast:', err);
    });
}

// Elimina usuarios que no han enviado señales recientemente
function checkInactiveUsers() {
    const now = Date.now();
    let changed = false;
    for (const [id, user] of connectedUsers.entries()) {
        if (now - user.lastSeen > USER_TIMEOUT) {
            connectedUsers.delete(id);
            changed = true;
        }
    }
    if (changed) {
        updateUserList();
    }
}

// Envía la lista actualizada de usuarios al renderer
function updateUserList() {
    if (mainWindow) {
        const usersArray = Array.from(connectedUsers.values());
        mainWindow.webContents.send('users:update', usersArray);
    }
}


// 2. Mensajería (TCP)
function startMessageServer() {
    tcpServer = net.createServer((socket) => {
        socket.on('data', (data) => {
            try {
                const messagePayload = JSON.parse(data.toString());
                console.log('Mensaje TCP recibido:', messagePayload);
                // Reenviar el mensaje al proceso de renderizado para mostrarlo
                if (mainWindow) {
                    mainWindow.webContents.send('message:receive', messagePayload);
                }
            } catch (error) {
                console.error('Error al recibir datos TCP:', error);
            }
        });

        socket.on('end', () => {
            console.log('Cliente TCP desconectado.');
        });
    });

    tcpServer.listen(userInfo.port, () => {
        console.log(`Servidor TCP escuchando en el puerto ${userInfo.port}`);
    });
}

function sendMessage(payload) {
    const { to, message, from } = payload;
    const messagePayload = JSON.stringify({ from, message });

    if (to === null) { // Mensaje para todos (broadcast)
        console.log(`Enviando mensaje a todos: ${message}`);
        connectedUsers.forEach(user => {
            if (user.id !== userInfo.id) { // No enviarse a sí mismo
                sendTcpMessage(user.ip, user.port, messagePayload);
            }
        });
    } else { // Mensaje directo
        console.log(`Enviando mensaje a ${to.username}: ${message}`);
        sendTcpMessage(to.ip, to.port, messagePayload);
    }
}

function sendTcpMessage(ip, port, data) {
    const client = new net.Socket();
    client.connect(port, ip, () => {
        client.write(data);
        client.end();
    });
    client.on('error', (err) => {
        console.error(`Error al conectar con ${ip}:${port} -`, err.message);
        // Podríamos eliminar al usuario si no se puede conectar
    });
}


// --- Eventos de la Aplicación Electron ---

app.whenReady().then(() => {
    createWindow();
    startMessageServer(); // Iniciar el servidor TCP primero

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        udpSocket.close();
        tcpServer.close();
        app.quit();
    }
});


// --- Comunicación IPC (Renderer <-> Main) ---

// El renderer notifica que el usuario ha elegido un nombre
ipcMain.on('user:ready', (event, { username }) => {
    userInfo.username = username;
    console.log(`Usuario establecido como: ${username}`);
    startDiscovery(); // Empezar a descubrir otros solo cuando tenemos un nombre
});

// El renderer quiere enviar un mensaje
ipcMain.on('message:send', (event, payload) => {
    sendMessage(payload);
});

