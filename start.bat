@echo off
setlocal
title GLA Broadcast Graphics
set "PROJDIR=%~dp0"
cd /d "%PROJDIR%"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] No se encontro Node.js en este equipo.
    echo Instala Node.js LTS desde https://nodejs.org/ y volve a ejecutar start.bat
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Instalando dependencias por primera vez...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Fallo npm install. Revisa el mensaje de arriba.
        echo.
        pause
        exit /b 1
    )
)

REM Si quedo un servidor de una sesion anterior mal cerrada, lo limpiamos primero.
if exist "%PROJDIR%.gla-server.pid" call "%PROJDIR%end.bat" silent

set GLA_PORT=4400

REM IP de red local (para pegar en vMix Browser Input desde otra PC de la misma red).
set "LAN_IP=127.0.0.1"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress"`) do set "LAN_IP=%%I"
if "%LAN_IP%"=="" set "LAN_IP=127.0.0.1"

REM Arranca el servidor en una ventana minimizada aparte para dejar esta
REM ventana libre y mostrar el menu de comandos.
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p = Start-Process -FilePath 'node' -ArgumentList 'server/index.js' -WorkingDirectory '%PROJDIR%' -WindowStyle Minimized -PassThru; Write-Output $p.Id"`) do set NODE_PID=%%P
echo %NODE_PID%>"%PROJDIR%.gla-server.pid"

start "" "http://localhost:%GLA_PORT%/master"

:menu
cls
echo ========================================
echo.
echo   MASTER CONTROL:
echo   http://localhost:%GLA_PORT%/master
echo.
echo   PROGRAM:
echo   http://localhost:%GLA_PORT%/program
echo.
echo   IP VMIX BROWSER:
echo   http://%LAN_IP%:%GLA_PORT%/program
echo.
echo ========================================
echo.
echo   En OBS o vMix: agregar Browser Source/Input
echo   con la URL de Program (fondo transparente,
echo   1920x1080, sin apagar la fuente si no esta visible).
echo.
echo   [P] Abrir Master Control
echo   [Q] Cerrar el software (END)
echo.
choice /c PQ /n /m "Esperando comando... "
if errorlevel 2 goto :shutdown
if errorlevel 1 goto :openmaster
goto :menu

:openmaster
start "" "http://localhost:%GLA_PORT%/master"
goto :menu

:shutdown
call "%PROJDIR%end.bat"
exit
