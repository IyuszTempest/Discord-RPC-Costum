$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "Discord-RPC.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptDir\start-silent.ps1`""
$shortcut.WorkingDirectory = $scriptDir
$shortcut.WindowStyle = 7
$shortcut.Description = "Discord Custom Rich Presence Auto-start"
$shortcut.Save()

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "[OK] Discord RPC berhasil dipasang ke Windows Startup!" -ForegroundColor Green
Write-Host "Lokasi shortcut : $shortcutPath" -ForegroundColor Gray
Write-Host "Script ini akan otomatis berjalan saat komputer dihidupkan." -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan
