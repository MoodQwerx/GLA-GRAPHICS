@echo off
cd /d "%~dp0"

REM Solo se mata el PID del .pid si sigue siendo node.exe: un .pid viejo
REM (corte de luz, reinicio) puede apuntar a un PID que Windows ya le dio
REM a otro programa.

if /i "%~1"=="silent" goto :silentkill

echo.
echo Cerrando SOFTX...

if not exist ".gla-server.pid" goto :noserver
set /p SAVED_PID=<".gla-server.pid"
tasklist /FI "PID eq %SAVED_PID%" /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul && taskkill /PID %SAVED_PID% /T /F >nul 2>nul
del ".gla-server.pid" >nul 2>nul
echo Servidor detenido correctamente.
goto :done

:noserver
echo No se encontro un servidor activo para cerrar.

:done
echo Listo. SOFTX fue cerrado.
echo.
pause
exit /b 0

:silentkill
if not exist ".gla-server.pid" exit /b 0
set /p SAVED_PID=<".gla-server.pid"
tasklist /FI "PID eq %SAVED_PID%" /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul && taskkill /PID %SAVED_PID% /T /F >nul 2>nul
del ".gla-server.pid" >nul 2>nul
exit /b 0
