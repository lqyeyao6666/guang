$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$serverPath = Join-Path $PSScriptRoot 'serve.mjs'
if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'dist\index.html'))) {
    throw 'Build output is missing. Run npm run build first.'
}
$serverArguments = '"' + $serverPath + '" --open'
Start-Process -FilePath $nodePath -ArgumentList $serverArguments -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $gameRoot 'runtime.log') -RedirectStandardError (Join-Path $gameRoot 'runtime-error.log')
