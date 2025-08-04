#!/bin/bash

# Script para crear releases optimizados de Delta7 Chat
echo "🚀 Creando releases optimizados de Delta7 Chat..."

# Crear directorio de releases
mkdir -p releases

# Compilar para macOS
echo "📱 Compilando para macOS..."
npm run dist:mac

# Compilar para Windows
echo "🪟 Compilando para Windows..."
npm run dist:win

# Crear releases separados por plataforma
echo "📦 Creando releases separados..."

# macOS Intel
cp "dist/Delta7 Chat-1.0.0-mac.zip" "releases/Delta7-Chat-macOS-Intel-v1.0.0.zip"
echo "✅ macOS Intel: releases/Delta7-Chat-macOS-Intel-v1.0.0.zip"

# macOS Apple Silicon
cp "dist/Delta7 Chat-1.0.0-arm64-mac.zip" "releases/Delta7-Chat-macOS-AppleSilicon-v1.0.0.zip"
echo "✅ macOS Apple Silicon: releases/Delta7-Chat-macOS-AppleSilicon-v1.0.0.zip"

# Windows Installer
cp "dist/Delta7 Chat Setup 1.0.0.exe" "releases/Delta7-Chat-Windows-Installer-v1.0.0.exe"
echo "✅ Windows Installer: releases/Delta7-Chat-Windows-Installer-v1.0.0.exe"

# Windows Portable
cp "dist/Delta7 Chat 1.0.0.exe" "releases/Delta7-Chat-Windows-Portable-v1.0.0.exe"
echo "✅ Windows Portable: releases/Delta7-Chat-Windows-Portable-v1.0.0.exe"

# Crear ZIP con solo los ejecutables principales (sin duplicados)
echo "📦 Creando ZIP optimizado..."
cd releases
zip -r "Delta7-Chat-v1.0.0-All-Platforms.zip" *.zip *.exe
cd ..

echo "🎉 ¡Releases creados exitosamente!"
echo "📁 Archivos en el directorio 'releases':"
ls -lh releases/ 