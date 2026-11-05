# Run from any working directory. No publishing or Git mutations.
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location -LiteralPath $taskRoot
try {
    npm --prefix frontend run format:check
    if ($LASTEXITCODE) { throw 'Frontend formatting check failed' }
    npm --prefix frontend test
    if ($LASTEXITCODE) { throw 'Frontend tests failed' }
    npm --prefix frontend run build
    if ($LASTEXITCODE) { throw 'Frontend production build failed' }
    New-Item -ItemType Directory -Force backend/tmp | Out-Null
    $taskTestTemp = 'backend/tmp/check-' + [Guid]::NewGuid().ToString('N')
    & backend/.venv/Scripts/python -m pytest backend -q --basetemp=$taskTestTemp -o cache_dir=backend/.pytest_cache
    if ($LASTEXITCODE) { throw 'Backend tests failed' }
    Write-Host 'All local checks passed.'
} finally {
    Pop-Location
}
