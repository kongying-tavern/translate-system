param(
    [Parameter(Mandatory, HelpMessage = "服务器地址，如 http://localhost:20080")]
    [string]$Endpoint,

    [Parameter(Mandatory, HelpMessage = "项目 Slug (UUID 或 code)")]
    [string]$ProjectSlug,

    [Parameter(HelpMessage = "API Key (ak_xxx)，与 -ConfigFile 二选一")]
    [string]$ApiKey,

    [Parameter(HelpMessage = "API Secret，与 -ConfigFile 二选一")]
    [string]$ApiSecret,

    [Parameter(HelpMessage = "鉴权信息文件路径（JSON 格式，包含 apiKey 和 apiSecret）")]
    [string]$AuthConfig,

    [Parameter(Mandatory, HelpMessage = "导出模板 Slug (UUID 或 code)，在 Web 端创建后使用")]
    [string]$TemplateSlug,

    [Parameter(Mandatory, HelpMessage = "输出目录")]
    [string]$OutputDir,

    [Parameter(HelpMessage = "过滤语言代码，逗号分隔（如 zh-Hans,en-US），留空则导出所有语言")]
    [string]$Languages = "",

    [Parameter(HelpMessage = "导出前清理已有文件")]
    [switch]$Delete,

    [Parameter(HelpMessage = "清理模式：file 仅删除 .json 文件，folder 删除整个目录")]
    [ValidateSet("file", "folder")]
    [string]$DeleteMode = "file"
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
if (-not $TemplateSlug) { $missing += "TemplateSlug" }
if (-not $OutputDir) { $missing += "OutputDir" }
if ($missing.Count -gt 0) {
    Write-Host "错误: 缺少必填参数: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

# ── 清理 ──
if ($Delete) {
    if (Test-Path $OutputDir) {
        if ($DeleteMode -eq "folder") {
            Remove-Item $OutputDir -Recurse -Force
            Write-Host "已删除目录: $OutputDir" -ForegroundColor Yellow
        } else {
            Remove-Item "$OutputDir\*.json" -Force -ErrorAction SilentlyContinue
            Write-Host "已删除 $OutputDir 下所有 .json 文件" -ForegroundColor Yellow
        }
    }
}

# 确保输出目录存在
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# ── 获取项目语言列表 ──
if ([string]::IsNullOrWhiteSpace($Languages)) {
    Write-Host "正在获取项目语言列表..." -ForegroundColor Cyan
    $langUrl = "$Endpoint/api/v1/apikey/projects/$ProjectSlug/languages"
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("x-api-key", $ApiKey)
        $wc.Headers.Add("x-api-secret", $ApiSecret)
        $rawJson = $wc.DownloadString($langUrl)
        $langObj = $rawJson | ConvertFrom-Json
        if ($langObj.code -ne 0) { throw $langObj.message }
        $langCodes = $langObj.data | ForEach-Object { $_.languageCode }
        if ($langCodes.Count -eq 0) { throw "项目没有配置任何语言" }
        Write-Host "发现 $($langCodes.Count) 种语言: $($langCodes -join ', ')" -ForegroundColor Cyan
    } catch {
        Write-Host "获取语言列表失败: $_" -ForegroundColor Red
        exit 1
    }
} else {
    $langCodes = $Languages -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
}

# ── 逐语言导出 ──
$exportUrl = "$Endpoint/api/v1/apikey/projects/$ProjectSlug/exports/generate"
$succeeded = 0
$failed = 0

foreach ($lang in $langCodes) {
    $body = @{
        templateSlug  = $TemplateSlug
        languageCodes = @($lang)
        filterTags    = @()
    } | ConvertTo-Json

    $outFile = Join-Path $OutputDir "$lang.json"
    Write-Host "导出 $lang ..." -NoNewline

    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("x-api-key", $ApiKey)
        $wc.Headers.Add("x-api-secret", $ApiSecret)
        $wc.Headers.Add("Content-Type", "application/json")
        $rawJson = $wc.UploadString($exportUrl, "POST", $body)
        $respObj = $rawJson | ConvertFrom-Json

        if ($respObj.code -eq 0) {
            $content = $respObj.data.content
            $content | Out-File -FilePath $outFile -Encoding utf8
            Write-Host " -> $outFile ($($content.Length) 字符)" -ForegroundColor Green
            $succeeded++
        } else {
            Write-Host " 错误: $($respObj.message)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host " 请求失败: $_" -ForegroundColor Red
        $failed++
    }
}

# ── 汇总 ──
Write-Host ""
Write-Host "完成: 成功 $succeeded, 失败 $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
