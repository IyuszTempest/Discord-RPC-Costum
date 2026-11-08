$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "Discord-RPC.lnk"
if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "[OK] Shortcut Discord-RPC berhasil dihapus dari Startup!" -ForegroundColor Green
    Write-Host "Script tidak akan berjalan otomatis lagi saat komputer hidup." -ForegroundColor Yellow
    Write-Host "======================================================" -ForegroundColor Cyan
} else {
    Write-Host "[INFO] Shortcut Discord-RPC tidak ditemukan di Startup." -ForegroundColor Yellow
}
