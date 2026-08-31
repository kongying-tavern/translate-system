param(
    [Alias("e")]
    [Parameter(Mandatory, HelpMessage = "服务器地址，如 http://localhost:20080")]
    [string]$Endpoint,

    [Alias("k")]
    [Parameter(HelpMessage = "API Key (ak_xxx)，与 -AuthConfig 二选一")]
    [string]$ApiKey,

    [Alias("s")]
    [Parameter(HelpMessage = "API Secret，与 -AuthConfig 二选一")]
    [string]$ApiSecret,

    [Alias("a")]
    [Parameter(HelpMessage = "鉴权信息文件路径（JSON 格式，包含 apiKey 和 apiSecret）")]
    [string]$AuthConfig,

    [Alias("p")]
    [Parameter(Mandatory, HelpMessage = "项目 Slug (UUID 或 code)")]
    [string]$ProjectSlug,

    [Alias("f")]
    [Parameter(Mandatory, HelpMessage = "数据文件路径（JSON / CSV / YAML / XML 格式）")]
    [string]$File,

    [Alias("o")]
    [Parameter(HelpMessage = "覆盖已有条目（默认不覆盖，只新增）")]
    [switch]$Overwrite
)

$ErrorActionPreference = "Stop"

# ── 加载配置文件 ──
if ($AuthConfig) {
    if (-not (Test-Path $AuthConfig)) {
        Write-Host "错误: 鉴权文件不存在: $AuthConfig" -ForegroundColor Red
        exit 1
    }
    $auth = Get-Content $AuthConfig -Raw | ConvertFrom-Json
    if (-not $ApiKey) { $ApiKey = $auth.apiKey }
    if (-not $ApiSecret) { $ApiSecret = $auth.apiSecret }
    Write-Host "已加载鉴权信息" -ForegroundColor Yellow
}

# ── 必填参数检查 ──
$missing = @()
if (-not $Endpoint) { $missing += "Endpoint" }
if (-not $ProjectSlug) { $missing += "ProjectSlug" }
if (-not $ApiKey) { $missing += "ApiKey 或 AuthConfig 文件中 apiKey" }
if (-not $ApiSecret) { $missing += "ApiSecret 或 AuthConfig 文件中 apiSecret" }
if (-not $File) { $missing += "File" }
if ($missing.Count -gt 0) {
    Write-Host "错误: 缺少必填参数: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

# ── 检查文件 ──
if (-not (Test-Path $File)) {
    Write-Host "错误: 文件不存在: $File" -ForegroundColor Red
    exit 1
}

# ── 读取文件内容并发送请求 ──
$fileContent = Get-Content $File -Raw
$body = @{ data = $fileContent; overwrite = $Overwrite.IsPresent } | ConvertTo-Json -Compress

Write-Host "正在导入条目到项目 $ProjectSlug ..." -ForegroundColor Cyan

try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("Content-Type", "application/json")
    $wc.Headers.Add("x-api-key", $ApiKey)
    $wc.Headers.Add("x-api-secret", $ApiSecret)
    $rawJson = $wc.UploadString("$Endpoint/api/v1/apikey/projects/$ProjectSlug/imports/entries", "POST", $body)
    $obj = $rawJson | ConvertFrom-Json
    if ($obj.code -ne 0) { throw $obj.message }
    Write-Host "导入完成: $($obj.data.imported) 条，新增 $($obj.data.created)，跳过 $($obj.data.skipped)" -ForegroundColor Green
} catch {
    Write-Host "导入失败: $_" -ForegroundColor Red
    exit 1
}
