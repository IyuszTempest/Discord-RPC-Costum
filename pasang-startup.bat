@echo off
title Pasang Discord RPC ke Startup
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-startup.ps1"
echo.
pause
