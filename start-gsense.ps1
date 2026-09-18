$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

Write-Host "Starting G Sense backend, web app, and mobile app..."
Write-Host "Set GEMINI_API_KEY in .env before live camera analysis."

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$PSScriptRoot'; `$env:PORT='5000'; `$env:BASE_PATH='/'; `$env:NODE_ENV='development'; pnpm --dir `"$PSScriptRoot/artifacts/api-server`" run dev"
) -WorkingDirectory $PSScriptRoot

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$PSScriptRoot'; `$env:PORT='5173'; `$env:BASE_PATH='/'; pnpm --dir `"$PSScriptRoot/artifacts/access-x-web`" run dev"
) -WorkingDirectory $PSScriptRoot

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$PSScriptRoot'; `$env:EXPO_PUBLIC_DOMAIN='localhost:5000'; pnpm --dir `"$PSScriptRoot/artifacts/access-x-mobile`" run dev"
) -WorkingDirectory $PSScriptRoot

Write-Host "Backend: http://localhost:5000"
Write-Host "Web: http://localhost:5173"
Write-Host "Mobile: Expo dev server via pnpm dev"
