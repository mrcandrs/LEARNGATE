Set-Location $PSScriptRoot\..
Add-Type -AssemblyName System.Drawing

$names = @("icon", "adaptive-icon", "splash-icon", "favicon")
foreach ($name in $names) {
  $path = Join-Path (Get-Location) "assets\$name.png"
  $tmp = "$path.tmp"
  $img = [System.Drawing.Image]::FromFile($path)
  $img.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
  Remove-Item $path -Force
  Rename-Item $tmp "$name.png"
  $check = [System.Drawing.Image]::FromFile($path)
  Write-Host "$name : $($check.Width)x$($check.Height)"
  $check.Dispose()
}

Write-Host "Done. Verify PNG signature:"
node -e "const fs=require('fs'); for (const f of ['icon','adaptive-icon','splash-icon','favicon']) { const b=fs.readFileSync('assets/'+f+'.png'); console.log(f, b.slice(0,4).toString('hex')); }"
