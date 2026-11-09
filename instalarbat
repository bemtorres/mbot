@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title MBot Studio - Instalador y Lanzador Automático

echo =======================================================
echo    🤖 MBot Studio - Instalador y Puesta en Marcha
echo =======================================================
echo.

:: 1. Verificar si Node.js está disponible en el sistema o en Laragon
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\laragon\bin\nodejs\node.exe" (
        echo [INFO] Utilizando Node.js de Laragon...
        set "PATH=C:\laragon\bin\nodejs;%PATH%"
    ) else (
        echo [ERROR] No se encontro Node.js instalado en el sistema.
        echo Por favor instala Node.js (v20 o v24 recomendado) desde:
        echo https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Node.js detectado:
node -v
echo.

:: 2. Crear archivo .env si no existe a partir de .env.example
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creando archivo de configuracion .env desde .env.example...
        copy ".env.example" ".env" >nul
        echo [OK] Archivo .env creado con exito.
    ) else (
        echo [INFO] Creando archivo .env inicial...
        echo PORT=3000> .env
        echo OPENAI_API_KEY=>> .env
        echo DEEPSEEK_API_KEY=>> .env
        echo [OK] Archivo .env generado.
    )
) else (
    echo [OK] Archivo .env existente detectado.
)
echo.

:: 3. Instalar dependencias de Node.js
echo [INFO] Instalando dependencias del proyecto (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Ocurrio un error al ejecutar 'npm install'.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas correctamente.
echo.

:: 4. Compilar Tailwind CSS localmente
echo [INFO] Compilando Tailwind CSS para la aplicacion (npm run build:css)...
call npm run build:css
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] No se pudo compilar el CSS inmediatamente. Se reintentara al iniciar.
) else (
    echo [OK] Tailwind CSS compilado en public/css/tailwind.css.
)
echo.

:: 5. Preguntar si se desea iniciar el servidor de inmediato
echo =======================================================
echo    ✅ ¡Instalacion completada con exito!
echo =======================================================
echo.
echo Opciones disponibles:
echo  1. Iniciar servidor MBot Studio ahora (http://localhost:3000)
echo  2. Salir
echo.
set /p opc="Selecciona una opcion (1 o 2) [Default 1]: "
if "%opc%"=="" set opc=1

if "%opc%"=="1" (
    echo.
    echo [INFO] Iniciando MBot Studio en http://localhost:3000 ...
    echo [INFO] Para detener el servidor presiona Ctrl + C en cualquier momento.
    echo.
    start "" http://localhost:3000
    call npm start
) else (
    echo.
    echo Puedes iniciar el servidor cuando quieras con:
    echo   npm start
    echo o ejecutando nuevamente este archivo.
    echo.
    pause
)
