param(
    [Parameter(Mandatory, HelpMessage = "项目 Slug 或 Code（如 my-project）")]
    [string]$ProjectCode,

    [Parameter(Mandatory, HelpMessage = "包含 JSON 文件的目录路径，文件名即为语言代码（zh-Hans.json、en-US.json）")]
    [string]$Directory
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Directory)) {
    Write-Host "错误: 目录不存在: $Directory" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未找到 pnpm，请先安装 Node.js 和 pnpm" -ForegroundColor Red
    exit 1
}

$scriptDir = Split-Path -Parent $PSCommandPath
$backendDir = Join-Path $scriptDir "..\backend"
Push-Location $backendDir

$files = Get-ChildItem "$Directory\*.json"
if ($files.Count -eq 0) {
    Write-Host "错误: 目录中没有 JSON 文件: $Directory" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "正在从 $Directory 导入 JSON 文件到项目 $ProjectCode" -ForegroundColor Cyan
Write-Host "--------------------"

$succeeded = 0
$failed = 0

foreach ($file in $files) {
    $lang = $file.BaseName
    Write-Host "[$lang] 导入 $($file.Name)..." -ForegroundColor Yellow
    try {
        pnpm tsx src/scripts/import-json.ts $ProjectCode $file.FullName $lang
        Write-Host "[$lang] 完成" -ForegroundColor Green
        $succeeded++
    } catch {
        Write-Host "[$lang] 失败: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host "--------------------"
$color = if ($failed -eq 0) { "Green" } else { "Yellow" }
Write-Host "导入完成: 成功 $succeeded, 失败 $failed" -ForegroundColor $color

Pop-Location
