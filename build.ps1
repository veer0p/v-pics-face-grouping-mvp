param(
  [switch]$SkipWebInstall,
  [switch]$SkipPyTests
)

$ErrorActionPreference = "Stop"

Write-Host "==> Python compile check"
python -m compileall face_cluster.py worker

if (-not $SkipPyTests) {
  Write-Host "==> Python tests"
  python -m pytest -q
}

if (-not $SkipWebInstall) {
  Write-Host "==> Web dependencies"
  npm --prefix web install
}

Write-Host "==> Web lint"
npm --prefix web run lint

Write-Host "==> Web build"
npm --prefix web run build

Write-Host "Build completed successfully."
