# PostgreSQL yedek alır. Docker Compose ayaktayken çalıştır:
#   pnpm backup
# Çıktı: backups/dating-YYYYMMDD-HHMMSS.sql.gz

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $root 'backups'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir "dating-$stamp.sql.gz"

docker compose -f (Join-Path $root 'docker-compose.yml') exec -T postgres pg_dump -U dating -d dating --no-owner --format=plain |
  gzip > $outFile

Write-Host "Yedek: $outFile"
