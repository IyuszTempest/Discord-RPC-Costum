@echo off
title Mulai Discord RPC (Background)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-silent.ps1"
echo [OK] Discord RPC telah dijalankan di background!
echo Cek rpc.log untuk melihat status koneksi.
timeout /t 3 >nul
