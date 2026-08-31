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

    [Alias("t")]
    [Parameter(Mandatory, HelpMessage = "导出模板 Slug (UUID 或 code)，在 Web 端创建后使用")]
    [string]$TemplateSlug,

    [Alias("o")]
    [Parameter(Mandatory, HelpMessage = "输出文件路径")]
    [string]$OutputFile,

    [Alias("l")]
    [Parameter(HelpMessage = "过滤语言，逗号分隔，支持语言代码或代码别名，留空则导出所有语言")]
    [string]$Languages = "",

    [Alias("g")]
    [Parameter(HelpMessage = "按标签过滤，逗号分隔，只导出含指定标签的条目")]
    [string]$FilterTags = "",

    [Alias("d")]
    [Parameter(HelpMessage = "导出前删除已存在的输出文件")]
    [switch]$Delete
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
if (-not $OutputFile) { $missing += "OutputFile" }
if ($missing.Count -gt 0) {
    Write-Host "错误: 缺少必填参数: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

# ── 删除已存在的输出文件 ──
if ($Delete -and (Test-Path $OutputFile)) {
    Remove-Item $OutputFile -Force
    Write-Host "已删除旧文件: $OutputFile" -ForegroundColor Yellow
}

# ── 获取项目语言列表 ──
Write-Host "正在获取项目语言列表..." -ForegroundColor Cyan
$langUrl = "$Endpoint/api/v1/apikey/projects/$ProjectSlug/languages"
$allCodes = @()
$aliasToCode = @{}
try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("x-api-key", $ApiKey)
    $wc.Headers.Add("x-api-secret", $ApiSecret)
    $rawJson = $wc.DownloadString($langUrl)
    $langObj = $rawJson | ConvertFrom-Json
    if ($langObj.code -ne 0) { throw $langObj.message }
    foreach ($item in $langObj.data) {
        $allCodes += $item.languageCode
        if ($item.codeAlias) { $aliasToCode[[string]$item.codeAlias] = [string]$item.languageCode }
    }
    if ($allCodes.Count -eq 0) { throw "项目没有配置任何语言" }
} catch {
    Write-Host "获取语言列表失败: $_" -ForegroundColor Red
    exit 1
}

# 解析目标语言（支持语言代码和代码别名匹配）
$langCodes = @()
if ([string]::IsNullOrWhiteSpace($Languages)) {
    $langCodes = $allCodes
} else {
    foreach ($entry in ($Languages -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })) {
        if ($allCodes -contains $entry) {
            $langCodes += $entry
        } elseif ($aliasToCode.ContainsKey($entry)) {
            $langCodes += $aliasToCode[$entry]
        } else {
            Write-Host "警告: 未匹配到语言: $entry" -ForegroundColor Yellow
        }
    }
}
if ($langCodes.Count -eq 0) { Write-Host "错误: 没有匹配的语言可供导出" -ForegroundColor Red; exit 1 }
Write-Host "发现 $($langCodes.Count) 种语言: $($langCodes -join ', ')" -ForegroundColor Cyan

# ── 模板检查 ──
$downloadableFormats = @('nested-json', 'nested-yaml', 'nested-xml', 'csv')
$templateUrl = "$Endpoint/api/v1/apikey/projects/$ProjectSlug/exports/templates/$TemplateSlug"
try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("x-api-key", $ApiKey)
    $wc.Headers.Add("x-api-secret", $ApiSecret)
    $tmplRaw = $wc.DownloadString($templateUrl)
    $tmplObj = $tmplRaw | ConvertFrom-Json
    if ($tmplObj.code -ne 0) { throw $tmplObj.message }
    $tmplFormat = $tmplObj.data.formatType
    if ($downloadableFormats -notcontains $tmplFormat) {
        Write-Host "错误: 模板格式 '$tmplFormat' 不适用于多语言导出，支持的格式: $($downloadableFormats -join ', ')" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "获取模板信息失败: $_" -ForegroundColor Red
    exit 1
}

# ── 一次性导出全部语言 ──
$exportUrl = "$Endpoint/api/v1/apikey/projects/$ProjectSlug/exports/generate"
$tagList = if ($FilterTags) { @($FilterTags -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) } else { @() }
$body = @{
    templateSlug  = $TemplateSlug
    languageCodes = $langCodes
    filterTags    = $tagList
} | ConvertTo-Json

Write-Host "导出全部语言到 $OutputFile ..." -NoNewline

try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("x-api-key", $ApiKey)
    $wc.Headers.Add("x-api-secret", $ApiSecret)
    $wc.Headers.Add("Content-Type", "application/json")
    $rawJson = $wc.UploadString($exportUrl, "POST", $body)
    $respObj = $rawJson | ConvertFrom-Json

    if ($respObj.code -eq 0) {
        $encoding = $respObj.data.encoding
        $content = $respObj.data.content
        if ($encoding -eq 'base64') {
            [Convert]::FromBase64String($content) | Set-Content -Path $OutputFile -Encoding Byte
        } else {
            [System.IO.File]::WriteAllText($OutputFile, $content)
        }
        $fileSize = if ($encoding -eq 'base64') { [Convert]::FromBase64String($content).Length } else { $content.Length }
        Write-Host " -> $OutputFile ($fileSize 字节)" -ForegroundColor Green
        Write-Host "完成" -ForegroundColor Green
    } else {
        Write-Host " 错误: $($respObj.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " 请求失败: $_" -ForegroundColor Red
    exit 1
}
