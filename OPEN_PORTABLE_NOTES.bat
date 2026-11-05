@echo off
setlocal
cd /d "%~dp0"
title Portable Notes 2.30.2
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 app.py
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python app.py
  goto :end
)
echo.
echo Python 3.9 or newer was not found.
echo Install Python from https://www.python.org/downloads/ and enable "Add Python to PATH".
echo.
pause
:end
endlocal
