param([switch]$Install)
$ErrorActionPreference = 'Stop'
$taskBackend = Split-Path -Parent $PSScriptRoot
$taskRoot = Split-Path -Parent $taskBackend
Set-Location -LiteralPath $taskRoot
if ($Install) {
    python -m venv backend\.venv
    if ($LASTEXITCODE) { throw 'Python environment setup failed' }
    & backend\.venv\Scripts\python -m pip install -r backend\requirements.lock.txt
    if ($LASTEXITCODE) { throw 'Python dependency installation failed' }
    npm --prefix frontend ci
    if ($LASTEXITCODE) { throw 'Frontend dependency installation failed' }
}
if (-not (Test-Path -LiteralPath backend/.env)) {
    Copy-Item -LiteralPath backend/.env.example -Destination backend/.env
}
npm --prefix frontend run build
if ($LASTEXITCODE) { throw 'Frontend build failed' }
& backend\.venv\Scripts\python -m uvicorn backend.main:app --env-file backend/.env --host 127.0.0.1 --port 8000
