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

REM "127.0.0.1" en vez de "localhost" (2026-09-23, auditoria de
REM performance): el hostname "localhost" mostro una demora real de red de
REM ~300ms en el primer pedido tras un rato inactivo (ver informe de
REM auditoria) -- Master Control abre con esta URL, y el Preview Monitor /
REM boton "Copiar" de adentro arma la URL de Program a partir de ese mismo
REM origen (location.origin), asi que este es el UNICO lugar que hace
REM falta tocar para que todo el flujo local (incluida la URL que
REM eventualmente se pega en OBS/vMix si se usa esta PC) evite esa demora.
start "" "http://127.0.0.1:%GLA_PORT%/master"

:menu
cls
echo ========================================
echo.
echo   MASTER CONTROL:
echo   http://127.0.0.1:%GLA_PORT%/master
echo.
echo   PROGRAM:
echo   http://127.0.0.1:%GLA_PORT%/program
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
start "" "http://127.0.0.1:%GLA_PORT%/master"
goto :menu

:shutdown
call "%PROJDIR%end.bat"
exit
