$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Set-Location $scriptDir

# Menjalankan node index.js di background tanpa jendela console
Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory $scriptDir -WindowStyle Hidden
