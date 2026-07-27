param(
    [Parameter(Mandatory, HelpMessage = "目标目录")]
    [string]$Target,

    [Parameter(Position = 0, HelpMessage = "命令: lock / unlock / status")]
    [ValidateSet("lock", "unlock", "status")]
    [string]$Command,

    [Parameter(HelpMessage = "lock: 清空目标目录后重建；unlock: 移动文件并从临时目录中删除原文件")]
    [switch]$Delete
)

$ErrorActionPreference = "Stop"

$lockFile = Join-Path $Target ".staging_lock"

switch ($Command) {
    "lock" {
        if (Test-Path $lockFile) {
            $existing = Get-Content $lockFile -Raw
            Write-Host "错误: 目标目录已锁定 (临时目录: $existing)" -ForegroundColor Red
            Write-Host "如要强制重建，请先运行: unlock" -ForegroundColor Yellow
            exit 1
        }
        if ($Delete -and (Test-Path $Target)) {
            Remove-Item "$Target\*" -Recurse -Force -ErrorAction SilentlyContinue
        }
        New-Item -ItemType Directory -Path $Target -Force | Out-Null
        $stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) "staging_$(Get-Random)"
        New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
        Set-Content -Path $lockFile -Value $stagingDir -NoNewline
        Write-Output $stagingDir
    }

    "unlock" {
        if (-not (Test-Path $lockFile)) {
            Write-Host "错误: 目标目录未锁定" -ForegroundColor Red
            exit 1
        }
        $stagingDir = Get-Content $lockFile -Raw
        if (-not (Test-Path $stagingDir)) {
            Write-Host "错误: 临时目录不存在: $stagingDir" -ForegroundColor Red
            Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
            exit 1
        }
        Get-ChildItem -Path $stagingDir | ForEach-Object {
            $dest = Join-Path $Target $_.Name
            if ($Delete) {
                Move-Item -Path $_.FullName -Destination $dest -Force
            } else {
                Copy-Item -Path $_.FullName -Destination $dest -Force
            }
        }
        Remove-Item $lockFile -Force
        if ($Delete) {
            Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Host "已同步到: $Target" -ForegroundColor Cyan
    }

    "status" {
        if (Test-Path $lockFile) {
            $stagingDir = Get-Content $lockFile -Raw
            Write-Host "locked: $stagingDir"
        } else {
            Write-Host "unlocked"
        }
    }
}
