@echo off
setlocal EnableExtensions
chcp 65001 >nul
title SOFTX
set "PROJDIR=%~dp0"
cd /d "%PROJDIR%"

REM SOFTX: unico arranque del proyecto. Uso:
REM   start.bat                      -> pregunta que sistema usar (START SOFTX)
REM   start.bat gla                  -> GLA RELAMPAGO directo
REM   start.bat argentinaStreamers   -> ARGENTINA STREAMERS directo
REM   start.bat bauletiBalanza       -> BAULETI vs BALANZA directo
REM El sistema elegido queda fijo hasta cerrar SOFTX (node server/index.js --system=...).
set "SOFTX_SYSTEM=%~1"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] No se encontro Node.js en este equipo.
    echo Instala Node.js LTS desde https://nodejs.org/ y volve a ejecutar SOFTX
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

if not "%SOFTX_SYSTEM%"=="" goto :validate

:selector
cls
echo ========================================
echo.
echo           BIENVENIDO A SOFTX
echo.
echo ========================================
echo.
echo   ¿QUÉ SOFTWARE VAMOS A UTILIZAR?
echo.
echo   [1] ARGENTINA STREAMERS
echo   [2] GLA RELÁMPAGO
echo   [3] BAULETI vs BALANZA
echo.
echo ========================================
echo.
set "OPCION="
set /p "OPCION=  Seleccioná una opción: "
if "%OPCION%"=="1" set "SOFTX_SYSTEM=argentinaStreamers"
if "%OPCION%"=="2" set "SOFTX_SYSTEM=gla"
if "%OPCION%"=="3" set "SOFTX_SYSTEM=bauletiBalanza"
if "%SOFTX_SYSTEM%"=="" goto :selector

:validate
set "SYSTEM_NAME="
if /i "%SOFTX_SYSTEM%"=="gla" set "SOFTX_SYSTEM=gla"
if /i "%SOFTX_SYSTEM%"=="gla" set "SYSTEM_NAME=GLA RELÁMPAGO"
if /i "%SOFTX_SYSTEM%"=="argentinaStreamers" set "SOFTX_SYSTEM=argentinaStreamers"
if /i "%SOFTX_SYSTEM%"=="argentinaStreamers" set "SYSTEM_NAME=ARGENTINA STREAMERS"
if /i "%SOFTX_SYSTEM%"=="bauletiBalanza" set "SOFTX_SYSTEM=bauletiBalanza"
if /i "%SOFTX_SYSTEM%"=="bauletiBalanza" set "SYSTEM_NAME=BAULETI vs BALANZA"
if "%SYSTEM_NAME%"=="" goto :badsystem
title SOFTX - %SYSTEM_NAME%

set GLA_PORT=4400

REM Cerrar CUALQUIER SOFTX anterior antes de arrancar (2026-10-30): no alcanza
REM con el .pid -- si un SOFTX viejo sigue escuchando el puerto, el nuevo no
REM puede abrirlo y quedaban "frontend nuevo + backend viejo". 1) el PID del
REM .pid; 2) todo "node server/index.js" que escuche el puerto; 3) esperar a
REM que el puerto quede LIBRE. Si lo ocupa otro programa, no se toca: error.
if exist "%PROJDIR%.gla-server.pid" call "%PROJDIR%end.bat" silent
powershell -NoProfile -Command "$port = %GLA_PORT%; $ids = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($id in $ids) { $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $id); if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'server[\\/]index\.js') { Write-Host ('  Cerrando SOFTX anterior (PID ' + $id + ')...'); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } elseif ($p) { Write-Host ('  El puerto ' + $port + ' lo usa otro programa: ' + $p.Name + ' (PID ' + $id + ').'); exit 2 } }; for ($i = 0; $i -lt 60; $i++) { if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { exit 0 }; Start-Sleep -Milliseconds 250 }; exit 1"
if errorlevel 1 goto :portbusy

REM IP de red local (para pegar en vMix Browser Input desde otra PC de la misma red).
set "LAN_IP=127.0.0.1"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress"`) do set "LAN_IP=%%I"
if "%LAN_IP%"=="" set "LAN_IP=127.0.0.1"

echo.
echo   Iniciando SOFTX - %SYSTEM_NAME% ...

REM Arranca el servidor en una ventana minimizada aparte para dejar esta
REM ventana libre y mostrar el menu de comandos.
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p = Start-Process -FilePath 'node' -ArgumentList 'server/index.js','--system=%SOFTX_SYSTEM%' -WorkingDirectory '%PROJDIR%' -WindowStyle Minimized -PassThru; Write-Output $p.Id"`) do set NODE_PID=%%P
echo %NODE_PID%>"%PROJDIR%.gla-server.pid"

REM Healthcheck: Master Control se abre recien cuando responde EL SERVIDOR
REM QUE ACABAMOS DE ARRANCAR (mismo PID), con el sistema elegido y con el
REM codigo actual de esta carpeta (/api/version, stale = false).
if "%NODE_PID%"=="" goto :startfailed
powershell -NoProfile -Command "for ($i = 0; $i -lt 80; $i++) { try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:%GLA_PORT%/api/version' -TimeoutSec 1; if ($r.pid -eq %NODE_PID% -and $r.system -eq '%SOFTX_SYSTEM%' -and -not $r.stale) { exit 0 } } catch {} ; Start-Sleep -Milliseconds 250 }; exit 1"
if errorlevel 1 goto :startfailed

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
echo   SOFTX - %SYSTEM_NAME%
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
echo   Para usar el otro sistema: cerrar SOFTX [Q]
echo   y volver a iniciarlo.
echo.
echo   [P] Abrir Master Control
echo   [Q] Cerrar SOFTX (END)
echo.
choice /c PQ /n /m "Esperando comando... "
if errorlevel 2 goto :shutdown
if errorlevel 1 goto :openmaster
goto :menu

:openmaster
start "" "http://127.0.0.1:%GLA_PORT%/master"
goto :menu

:shutdown
REM Si despues se abrio otro START, esta ventana quedo vieja: su [Q] no debe
REM cerrar el servidor que levanto la ventana nueva.
set "CURRENT_PID="
if exist "%PROJDIR%.gla-server.pid" set /p CURRENT_PID=<"%PROJDIR%.gla-server.pid"
if not "%CURRENT_PID%"=="%NODE_PID%" goto :stalewindow
call "%PROJDIR%end.bat"
exit

:stalewindow
echo.
echo   Esta ventana de SOFTX quedo vieja: el servidor activo lo abrio
echo   otra ventana START. No se cerro nada.
echo.
pause
exit

:portbusy
echo.
echo [ERROR] El puerto %GLA_PORT% sigue ocupado y SOFTX no puede arrancar.
echo Si es otro programa, cerralo y volve a intentar.
echo.
pause
exit /b 1

:badsystem
echo.
echo [ERROR] Sistema desconocido: "%SOFTX_SYSTEM%".
echo Usar: start.bat gla   /   start.bat argentinaStreamers   /   start.bat bauletiBalanza
echo.
pause
exit /b 1

:startfailed
echo.
echo [ERROR] SOFTX no respondio como %SYSTEM_NAME% en el puerto %GLA_PORT%.
echo Puede haber otra instancia abierta: cerrala (END) y volve a intentar.
echo Detalle del servidor: revisar la ventana minimizada de Node.
echo.
call "%PROJDIR%end.bat" silent
pause
exit /b 1
