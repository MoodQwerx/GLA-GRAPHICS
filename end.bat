@echo off
cd /d "%~dp0"

if /i "%~1"=="silent" goto :silentkill

echo.
echo Cerrando GLA Broadcast Graphics...

if not exist ".gla-server.pid" goto :noserver
set /p SAVED_PID=<".gla-server.pid"
taskkill /PID %SAVED_PID% /T /F >nul 2>nul
del ".gla-server.pid" >nul 2>nul
echo Servidor detenido correctamente.
goto :done

:noserver
echo No se encontro un servidor activo para cerrar.

:done
echo Listo. El software fue cerrado.
echo.
pause
exit /b 0

:silentkill
if not exist ".gla-server.pid" exit /b 0
set /p SAVED_PID=<".gla-server.pid"
taskkill /PID %SAVED_PID% /T /F >nul 2>nul
del ".gla-server.pid" >nul 2>nul
exit /b 0
