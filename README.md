# Delta7 Chat - Chat P2P para LAN

Una aplicación de chat peer-to-peer para redes locales (LAN) construida con Electron.

**Autor:** Marc Bonnin

## 🚀 Características

- **Descubrimiento automático**: Encuentra automáticamente otros usuarios en tu red local
- **Mensajería en tiempo real**: Envía mensajes instantáneos usando TCP
- **Chat general y privado**: Envía mensajes a todos o a usuarios específicos
- **Interfaz moderna**: Diseño limpio y responsive con Tailwind CSS
- **Sin servidor central**: Comunicación directa entre usuarios

## 📋 Requisitos

- Node.js 16 o superior
- npm o yarn
- Red local (LAN) para descubrir otros usuarios

## 🛠️ Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   git clone https://github.com/xsocietylab/DeskChat2.git
   cd delta7-chat
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Ejecutar la aplicación**
   ```bash
   npm start
   ```

## 🏗️ Construir para distribución

Para crear un ejecutable:

```bash
npm run dist
```

## 🔧 Configuración de red

La aplicación usa los siguientes puertos:
- **UDP 33333**: Para descubrimiento de usuarios
- **TCP 33334**: Para mensajería

Asegúrate de que estos puertos estén abiertos en tu firewall.

## 📁 Estructura del proyecto

```
delta7-chat/
├── main.js          # Proceso principal de Electron
├── preload.js       # Script de precarga (seguridad)
├── index.html       # Interfaz de usuario
├── package.json     # Configuración del proyecto
└── README.md        # Este archivo
```

## 🔒 Seguridad

- Context isolation habilitado
- APIs expuestas de forma segura
- Validación de canales IPC
- Sin integración directa de Node.js en el renderer

## 🐛 Solución de problemas

### La aplicación no encuentra otros usuarios
- Verifica que estés en la misma red local
- Asegúrate de que los puertos 33333 y 33334 estén abiertos
- Revisa la configuración del firewall

### Error al iniciar
- Verifica que Node.js esté instalado correctamente
- Ejecuta `npm install` para instalar dependencias
- Revisa la consola para mensajes de error

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 👨‍💻 Autor

**Marc Bonnin**

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si encuentras algún problema o tienes preguntas, por favor abre un issue en el repositorio. 
