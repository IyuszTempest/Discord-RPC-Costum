@echo off
title Hapus Discord RPC dari Startup
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0hapus-startup.ps1"
echo.
pause
