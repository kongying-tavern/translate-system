param(
    [Parameter(Mandatory, HelpMessage = "服务器地址，如 http://localhost:20080")]
    [string]$Endpoint,

    [Parameter(HelpMessage = "API Key (ak_xxx)，与 -AuthConfig 二选一")]
    [string]$ApiKey,

    [Parameter(HelpMessage = "API Secret，与 -AuthConfig 二选一")]
    [string]$ApiSecret,

    [Parameter(HelpMessage = "鉴权信息文件路径（JSON 格式，包含 apiKey 和 apiSecret）")]
    [string]$AuthConfig,

    [Parameter(Mandatory, HelpMessage = "项目 Slug (UUID 或 code)")]
    [string]$ProjectSlug,

    [Parameter(Mandatory, HelpMessage = "导出模板 Slug (UUID 或 code)，在 Web 端创建后使用")]
    [string]$TemplateSlug,

    [Parameter(Mandatory, HelpMessage = "输出目录")]
    [string]$OutputDir,

    [Parameter(HelpMessage = "过滤语言代码，逗号分隔（如 zh-Hans,en-US），留空则导出所有语言")]
    [string]$Languages = "",

    [Parameter(HelpMessage = "不使用语言别名作为文件名，改用语言代码")]
    [switch]$NoAlias,

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

# ── 清理（folder 模式） ──
if ($Delete -and $DeleteMode -eq "folder" -and (Test-Path $OutputDir)) {
    Remove-Item $OutputDir -Recurse -Force
    Write-Host "已删除目录: $OutputDir" -ForegroundColor Yellow
}

# 确保输出目录存在
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# ── 获取项目语言列表 ──
Write-Host "正在获取项目语言列表..." -ForegroundColor Cyan
$langUrl = "$Endpoint/api/v1/apikey/projects/$ProjectSlug/languages"
$aliasMap = @{}
$codeMap = @{}
$allCodes = @()
try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("x-api-key", $ApiKey)
    $wc.Headers.Add("x-api-secret", $ApiSecret)
    $rawJson = $wc.DownloadString($langUrl)
    $langObj = $rawJson | ConvertFrom-Json
    if ($langObj.code -ne 0) { throw $langObj.message }
    foreach ($item in $langObj.data) {
        $allCodes += $item.languageCode
        if ($item.alias) {
            $aliasMap[$item.languageCode] = $item.alias
            $codeMap[$item.alias] = $item.languageCode
        }
    }
    if ($allCodes.Count -eq 0) { throw "项目没有配置任何语言" }
} catch {
    Write-Host "获取语言列表失败: $_" -ForegroundColor Red
    exit 1
}

# 解析目标语言（支持 code 和 alias 匹配）
$langCodes = @()
if ([string]::IsNullOrWhiteSpace($Languages)) {
    $langCodes = $allCodes
} else {
    foreach ($entry in ($Languages -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })) {
        if ($allCodes -contains $entry) {
            $langCodes += $entry
        } elseif ($codeMap.ContainsKey($entry)) {
            $langCodes += $codeMap[$entry]
        } else {
            Write-Host "警告: 未匹配到语言: $entry" -ForegroundColor Yellow
        }
    }
}
if ($langCodes.Count -eq 0) { Write-Host "错误: 没有匹配的语言可供导出" -ForegroundColor Red; exit 1 }
Write-Host "发现 $($langCodes.Count) 种语言: $($langCodes -join ', ')" -ForegroundColor Cyan

# ── 模板检查 ──
$downloadableFormats = @('flat-json', 'nested-json', 'flat-yaml', 'nested-yaml', 'properties', 'flat-xml', 'nested-xml', 'csv')
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
        Write-Host "错误: 模板格式 '$tmplFormat' 不适用于逐语言下载，支持的格式: $($downloadableFormats -join ', ')" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "获取模板信息失败: $_" -ForegroundColor Red
    exit 1
}

# ── 逐语言导出 ──
$exportUrl = "$Endpoint/api/v1/apikey/projects/$ProjectSlug/exports/generate"
$succeeded = 0
$failed = 0

foreach ($code in $langCodes) {
    if ($NoAlias) {
        $name = $code
    } else {
        $name = if ($aliasMap.ContainsKey($code)) { $aliasMap[$code] } else { $code }
    }

    $body = @{
        templateSlug  = $TemplateSlug
        languageCodes = @($code)
        filterTags    = @()
    } | ConvertTo-Json

    Write-Host "导出 $code ..." -NoNewline

    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("x-api-key", $ApiKey)
        $wc.Headers.Add("x-api-secret", $ApiSecret)
        $wc.Headers.Add("Content-Type", "application/json")
        $rawJson = $wc.UploadString($exportUrl, "POST", $body)
        $respObj = $rawJson | ConvertFrom-Json

        if ($respObj.code -eq 0) {
            $format = $respObj.data.format
            $encoding = $respObj.data.encoding
            $content = $respObj.data.content
            $outFile = Join-Path $OutputDir "$name.$format"
            if ($Delete -and $DeleteMode -eq "file" -and (Test-Path $outFile)) {
                Remove-Item $outFile -Force
                Write-Host "已删除旧文件: $outFile" -ForegroundColor Yellow
            }
            if ($encoding -eq 'base64') {
                [Convert]::FromBase64String($content) | Set-Content -Path $outFile -Encoding Byte
            } else {
                $content | Out-File -FilePath $outFile -Encoding utf8
            }
            $fileSize = if ($encoding -eq 'base64') { [Convert]::FromBase64String($content).Length } else { $content.Length }
            Write-Host " -> $outFile ($fileSize 字节)" -ForegroundColor Green
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
