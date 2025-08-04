// main.js - Proceso principal de Electron

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dgram = require('dgram');
const net = require('net');
const os = require('os');

// --- Constantes de Red ---
const DISCOVERY_PORT = 33333; // Puerto para descubrimiento UDP
const MESSAGE_PORT_BASE = 33334;   // Puerto base para mensajería TCP
const BROADCAST_ADDRESS = '255.255.255.255';
const DISCOVERY_INTERVAL = 3000; // 3 segundos para descubrimiento más rápido
const USER_TIMEOUT = 10000; // 10 segundos para detectar desconexiones más rápido
const MAX_PORT_ATTEMPTS = 10; // Máximo intentos para encontrar puerto libre

// --- Variables Globales ---
let mainWindow;
let udpSocket;
let tcpServer;
let userInfo = {
    id: generateUniqueId(),
    username: 'Desconocido',
    ip: getLocalIp(),
    port: null // Se asignará dinámicamente
};
let connectedUsers = new Map(); // Almacena los usuarios conectados
let lastUserCount = 0; // Para detectar cambios en la cantidad de usuarios
let discoveryLog = new Set(); // Para evitar logs duplicados

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

// Encuentra un puerto libre para el servidor TCP
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                // Puerto ocupado, intentar el siguiente
                findAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}


// --- Lógica de la Aplicación ---

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            enableRemoteModule: false
        },
        title: 'Delta7 Chat',
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
        
        // Broadcast inicial para descubrimiento rápido
        setTimeout(initialBroadcast, 100);
        
        // Empezar a anunciar nuestra presencia periódicamente
        setInterval(broadcastPresence, DISCOVERY_INTERVAL);
    });

    udpSocket.on('message', (message, rinfo) => {
        try {
            const user = JSON.parse(message.toString());
            
            // Ignorar mensajes propios (mismo ID)
            if (user.id === userInfo.id) return;
            
            const wasNewUser = !connectedUsers.has(user.id);
            
            // Añadir o actualizar usuario en el mapa
            user.lastSeen = Date.now();
            user.ip = rinfo.address; // Usar la IP real del remitente
            connectedUsers.set(user.id, user);
            
            // Solo notificar si es un usuario nuevo
            if (wasNewUser) {
                console.log(`🟢 Usuario conectado: ${user.username} (${user.ip}:${user.port})`);
                discoveryLog.add(user.id);
            }
            
            updateUserList();
            
            // Responder con nuestra información para confirmar (solo si es nuevo)
            if (wasNewUser) {
                setTimeout(() => broadcastPresence(), 100);
            }
        } catch (error) {
            console.error('Error al parsear mensaje de descubrimiento:', error);
        }
    });

    udpSocket.on('error', (err) => {
        console.error('Error en socket UDP:', err);
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

// Broadcast inicial para anunciar presencia
function initialBroadcast() {
    console.log('🔍 Iniciando descubrimiento de usuarios...');
    broadcastPresence();
}

// Elimina usuarios que no han enviado señales recientemente
function checkInactiveUsers() {
    const now = Date.now();
    let changed = false;
    const disconnectedUsers = [];
    
    for (const [id, user] of connectedUsers.entries()) {
        if (now - user.lastSeen > USER_TIMEOUT) {
            disconnectedUsers.push(user.username);
            connectedUsers.delete(id);
            discoveryLog.delete(id);
            changed = true;
        }
    }
    
    if (changed) {
        if (disconnectedUsers.length > 0) {
            console.log(`🔴 Usuarios desconectados: ${disconnectedUsers.join(', ')}`);
        }
        updateUserList();
    }
}

// Envía la lista actualizada de usuarios al renderer
function updateUserList() {
    if (mainWindow) {
        const usersArray = Array.from(connectedUsers.values());
        const currentUserCount = usersArray.length;
        
        // Solo actualizar si hay cambios en la cantidad de usuarios
        if (currentUserCount !== lastUserCount) {
            console.log(`📊 Usuarios conectados: ${currentUserCount}`);
            lastUserCount = currentUserCount;
        }
        
        mainWindow.webContents.send('users:update', usersArray);
    }
}


// 2. Mensajería (TCP)
async function startMessageServer() {
    try {
        // Encontrar un puerto libre
        const availablePort = await findAvailablePort(MESSAGE_PORT_BASE);
        userInfo.port = availablePort;
        
        tcpServer = net.createServer((socket) => {
            socket.on('data', (data) => {
                try {
                    const messagePayload = JSON.parse(data.toString());
                    console.log(`📥 Mensaje recibido de ${messagePayload.from}: "${messagePayload.message}"`);
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
    } catch (error) {
        console.error('Error al iniciar servidor TCP:', error);
    }
}

function sendMessage(payload) {
    const { to, message, from } = payload;
    const messagePayload = JSON.stringify({ from, message });

    if (to === null) { // Mensaje para todos (broadcast)
        console.log(`📤 Enviando mensaje general: "${message}"`);
        let sentCount = 0;
        connectedUsers.forEach(user => {
            if (user.id !== userInfo.id) { // No enviarse a sí mismo
                sendTcpMessage(user.ip, user.port, messagePayload);
                sentCount++;
            }
        });
        console.log(`✅ Mensaje enviado a ${sentCount} usuarios`);
    } else { // Mensaje directo
        console.log(`📤 Enviando mensaje privado a ${to.username}: "${message}"`);
        sendTcpMessage(to.ip, to.port, messagePayload);
    }
}

function sendTcpMessage(ip, port, data) {
    const client = new net.Socket();
    
    // Timeout para la conexión
    const timeout = setTimeout(() => {
        client.destroy();
        console.error(`Timeout al conectar con ${ip}:${port}`);
    }, 5000);
    
    client.connect(port, ip, () => {
        clearTimeout(timeout);
        client.write(data);
        client.end();
    });
    
    client.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`Error al conectar con ${ip}:${port} -`, err.message);
        // Eliminar al usuario si no se puede conectar
        for (const [id, user] of connectedUsers.entries()) {
            if (user.ip === ip && user.port === port) {
                console.log(`Eliminando usuario ${user.username} por error de conexión`);
                connectedUsers.delete(id);
                updateUserList();
                break;
            }
        }
    });
    
    client.on('close', () => {
        clearTimeout(timeout);
    });
}


// --- Eventos de la Aplicación Electron ---

app.whenReady().then(async () => {
    try {
        createWindow();
        await startMessageServer(); // Iniciar el servidor TCP primero
        console.log('Aplicación iniciada correctamente');
        console.log(`Usuario ID: ${userInfo.id}`);
        console.log(`IP Local: ${userInfo.ip}`);
    } catch (error) {
        console.error('Error al iniciar la aplicación:', error);
    }

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
    console.log(`👤 Usuario establecido como: ${username}`);
    console.log(`🌐 IP Local: ${userInfo.ip}:${userInfo.port}`);
    startDiscovery(); // Empezar a descubrir otros solo cuando tenemos un nombre
});

// El renderer quiere enviar un mensaje
ipcMain.on('message:send', (event, payload) => {
    sendMessage(payload);
});

