param(
    [Parameter(Mandatory, HelpMessage = "服务器地址，如 http://localhost:20080")]
    [string]$Endpoint,

    [Parameter(HelpMessage = "API Key (ak_xxx)，与 -AuthConfig 二选一")]
    [string]$ApiKey,

    [Parameter(HelpMessage = "API Secret，与 -AuthConfig 二选一")]
    [string]$ApiSecret,

    [Parameter(HelpMessage = "鉴权信息文件路径（JSON，包含 apiKey 和 apiSecret）")]
    [string]$AuthConfig,

    [Parameter(Mandatory, HelpMessage = "项目 Slug (UUID 或 code)")]
    [string]$ProjectSlug,

    [Parameter(HelpMessage = "过滤语言，逗号分隔，支持 code 或 alias，不传则全部")]
    [string]$Languages = "",

    [Parameter(HelpMessage = "按标签过滤，逗号分隔，只统计含指定标签的条目")]
    [string]$FilterTags = "",

    [Parameter(HelpMessage = "文件名和输出的 langCode 使用语言代码而非别名")]
    [switch]$NoAlias,

    [Parameter(HelpMessage = "输入文件类型: json, yaml, xml, properties, csv（默认 json）")]
    [ValidateSet("json", "yaml", "xml", "properties", "csv")]
    [string]$InputFormat = "json",

    [Parameter(HelpMessage = "输出文件类型: json, yaml, xml（默认 json）")]
    [ValidateSet("json", "yaml", "xml")]
    [string]$OutputFormat = "json",

    [Parameter(Mandatory, HelpMessage = "包含翻译文件的目录")]
    [string]$InputDir,

    [Parameter(HelpMessage = "输出文件路径，默认 <InputDir>/summary.json")]
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

$inExt = $InputFormat
$outExt = $OutputFormat

# ── 加载鉴权配置 ──
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
if (-not $Endpoint)   { $missing += "Endpoint" }
if (-not $ApiKey)     { $missing += "ApiKey 或 AuthConfig 文件中 apiKey" }
if (-not $ApiSecret)  { $missing += "ApiSecret 或 AuthConfig 文件中 apiSecret" }
if (-not $ProjectSlug){ $missing += "ProjectSlug" }
if (-not $InputDir)   { $missing += "InputDir" }
if ($missing.Count -gt 0) {
    Write-Host "错误: 缺少必填参数: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $InputDir -PathType Container)) {
    Write-Host "错误: 目录不存在: $InputDir" -ForegroundColor Red
    exit 1
}

if (-not $OutputFile) {
    $OutputFile = Join-Path $InputDir "summary.$outExt"
}

# ── 调接口 ──
$apiBase = "$($Endpoint.TrimEnd('/'))/api/v1/apikey"
$headers = @{ "x-api-key" = $ApiKey; "x-api-secret" = $ApiSecret }

Write-Host "正在获取项目语言列表..." -ForegroundColor Cyan
try {
    $langResp = Invoke-RestMethod -Uri "$apiBase/projects/$ProjectSlug/languages" -Headers $headers -Method Get
    $langData = @($langResp.data)
} catch {
    Write-Host "错误: 获取语言列表失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host "正在获取翻译总数..." -ForegroundColor Cyan
$tagQuery = if ($FilterTags) { "?tags=$([uri]::EscapeDataString(($FilterTags -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ } ) -join ','))" } else { "" }
try {
    $countResp = Invoke-RestMethod -Uri "$apiBase/projects/$ProjectSlug/translations/count$tagQuery" -Headers $headers -Method Get
    $total = $countResp.data.total
} catch {
    Write-Host "错误: 获取总数失败: $_" -ForegroundColor Red
    exit 1
}
Write-Host "总条目数: $total" -ForegroundColor Cyan

# ── 构建索引 ──
$codeToAlias = @{}
$aliasToCode = @{}
foreach ($l in $langData) {
    $alias = if ($l.alias) { $l.alias } else { $l.languageCode }
    $codeToAlias[$l.languageCode] = $alias
    if ($alias -ne $l.languageCode) { $aliasToCode[$alias] = $l.languageCode }
}

# ── 过滤语言 ──
$targetLangs = @()
if ($Languages) {
    $filter = $Languages.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    foreach ($f in $filter) {
        $found = $langData | Where-Object { $_.languageCode -eq $f }
        if ($found) { $targetLangs += $found; continue }
        $code = $aliasToCode[$f]
        if ($code) { $targetLangs += $langData | Where-Object { $_.languageCode -eq $code } }
    }
} else {
    $targetLangs = $langData
}

if ($targetLangs.Count -eq 0) {
    Write-Host "错误: 没有可处理的语言" -ForegroundColor Red
    exit 1
}

# ── 逐个处理 ──
# ── 输入解析方法 ──
function ConvertFrom-SummaryJson($text) {
    return $text | ConvertFrom-Json
}
function ConvertFrom-SummaryYaml($text) {
    $obj = @{}
    foreach ($line in ($text -split '\r?\n')) {
        if ($line -match '^\s*([^#:]+?):\s*(.*)') {
            $k = $matches[1].Trim()
            $v = $matches[2].Trim()
            if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
                $v = $v.Substring(1, $v.Length - 2)
            }
            $obj[$k] = $v
        }
    }
    return $obj
}
function ConvertFrom-SummaryXml($text) {
    function DecodeXml($s) {
        return $s -replace '&amp;','&' -replace '&lt;','<' -replace '&gt;','>' -replace '&quot;','"' -replace '&apos;',"'"
    }
    $obj = @{}
    [regex]::Matches($text, '<string\s+name="([^"]*)"[^>]*>(.*?)</string>') | ForEach-Object {
        $val = $_.Groups[2].Value
        $cd = [regex]::Match($val, '^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$')
        $obj[$_.Groups[1].Value] = DecodeXml $(if ($cd.Success) { $cd.Groups[1].Value } else { $val })
    }
    return $obj
}
function ConvertFrom-SummaryProperties($text) {
    function UnescapeProps($s) {
        $s -replace '\\(.)', { param($m) $c = $m.Groups[1].Value; if ($c -eq 'n') { "`n" } elseif ($c -eq 'r') { "`r" } elseif ($c -eq 't') { "`t" } else { $c } }
    }
    $obj = @{}
    foreach ($line in ($text -split '\r?\n')) {
        $line = $line.Trim()
        if (-not $line -or $line[0] -eq '#' -or $line[0] -eq '!') { continue }
        $idx = $line.IndexOf('='); if ($idx -lt 0) { $idx = $line.IndexOf(':') }
        if ($idx -lt 0) { continue }
        $k = $line.Substring(0, $idx).Trim()
        $v = UnescapeProps $line.Substring($idx + 1).Trim()
        $obj[$k] = $v
    }
    return $obj
}
function ConvertFrom-SummaryCsv($text) {
    $obj = @{}
    $lines = ($text -split '\r?\n') | Where-Object { $_ -ne "" }
    if ($lines.Count -lt 2) { return $obj }
    $headers = ParseCsvLine $lines[0]
    $keyIdx = [array]::IndexOf($headers, "key"); if ($keyIdx -lt 0) { $keyIdx = 0 }
    $valIdx = $headers.Count - 1
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $row = ParseCsvLine $lines[$i]
        if ($row.Count -gt $keyIdx) { $obj[$row[$keyIdx]] = if ($row.Count -gt $valIdx) { $row[$valIdx] } else { "" } }
    }
    return $obj
}
function ParseCsvLine($line) {
    $result = @(); $cur = ""; $inQ = $false
    for ($i = 0; $i -lt $line.Length; $i++) {
        $c = $line[$i]
        if ($inQ) {
            if ($c -eq '"') { if ($i + 1 -lt $line.Length -and $line[$i+1] -eq '"') { $cur += '"'; $i++ } else { $inQ = $false } }
            else { $cur += $c }
        } elseif ($c -eq '"') { $inQ = $true }
        elseif ($c -eq ',') { $result += $cur; $cur = "" }
        else { $cur += $c }
    }
    $result += $cur
    return $result
}

$parseMap = @{
    json       = ${function:ConvertFrom-SummaryJson}
    yaml       = ${function:ConvertFrom-SummaryYaml}
    xml        = ${function:ConvertFrom-SummaryXml}
    properties = ${function:ConvertFrom-SummaryProperties}
    csv        = ${function:ConvertFrom-SummaryCsv}
}
$parseInput = if ($parseMap.ContainsKey($inExt)) { $parseMap[$inExt] } else { ${function:ConvertFrom-SummaryJson} }

$result = @()
foreach ($l in $targetLangs) {
    $code = $l.languageCode
    $alias = $codeToAlias[$code]
    $logicLangCode = if ($NoAlias) { $code } else { if ($alias) { $alias } else { $code } }

    if ($FilterTags) {
        # 标签过滤模式：使用 API 获取已翻译数，跳过本地文件
        try {
            $lcQuery = [uri]::EscapeDataString($code)
            $tQuery = [uri]::EscapeDataString(($FilterTags -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ } ) -join ',')
            $lcResp = Invoke-RestMethod -Uri "$apiBase/projects/$ProjectSlug/translations/count?languageCode=$lcQuery&tags=$tQuery" -Headers $headers -Method Get
            $translated = $lcResp.data.translated
        } catch {
            Write-Host "错误: 获取语言 $code 统计失败: $_" -ForegroundColor Red
            continue
        }
        $ratio = if ($total -gt 0) { [Math]::Round(($translated / $total * 100), 8) } else { 0 }
        $md5Hash = ""
        $result += [PSCustomObject]@{
            langName = $code
            langCode = $logicLangCode
            md5Hash  = $md5Hash
            summary  = [PSCustomObject]@{
                countTotal      = $total
                countTranslated = $translated
                ratioTranslated = $ratio
            }
        }
        continue
    }

    $filePath = Join-Path $InputDir "$logicLangCode.$inExt"

    if (-not (Test-Path $filePath)) {
        Write-Host "文件不存在，跳过: $filePath" -ForegroundColor Yellow
        continue
    }

    $content = & $parseInput (Get-Content $filePath -Raw)
    $keys = $content.PSObject.Properties
    $translated = 0
    $texts = [System.Collections.ArrayList]@()
    foreach ($prop in $keys) {
        $v = "$($prop.Value)".Trim()
        if ($v) { $translated++; [void]$texts.Add($v) }
    }
    $texts.Sort()
    $joined = $texts -join ""
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $md5Bytes = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($joined))
    $md5Hash = [System.BitConverter]::ToString($md5Bytes).Replace("-", "").ToLower()
    $ratio = if ($total -gt 0) { [Math]::Round(($translated / $total * 100), 8) } else { 0 }

    $result += [PSCustomObject]@{
        langName = $code
        langCode = $logicLangCode
        md5Hash  = $md5Hash
        summary  = [PSCustomObject]@{
            countTotal      = $total
            countTranslated = $translated
            ratioTranslated = $ratio
        }
    }
}

# ── 序列化方法 ──
function ConvertTo-SummaryYaml($data) {
    $lines = [System.Collections.ArrayList]@()
    foreach ($r in $data) {
        [void]$lines.Add("- langName: $($r.langName | ConvertTo-Json -Compress)")
        [void]$lines.Add("  langCode: $($r.langCode | ConvertTo-Json -Compress)")
        [void]$lines.Add("  md5Hash: $($r.md5Hash | ConvertTo-Json -Compress)")
        [void]$lines.Add("  summary:")
        [void]$lines.Add("    countTotal: $($r.summary.countTotal)")
        [void]$lines.Add("    countTranslated: $($r.summary.countTranslated)")
        [void]$lines.Add("    ratioTranslated: $($r.summary.ratioTranslated)")
    }
    return ($lines -join "`n") + "`n"
}
function ConvertTo-SummaryXml($data) {
    $lines = [System.Collections.ArrayList]@()
    [void]$lines.Add('<?xml version="1.0" encoding="UTF-8"?>')
    [void]$lines.Add('<languages>')
    foreach ($r in $data) {
        $lc = [System.Security.SecurityElement]::Escape($r.langCode)
        $ln = [System.Security.SecurityElement]::Escape($r.langName)
        $mh = [System.Security.SecurityElement]::Escape($r.md5Hash)
        [void]$lines.Add("  <language code=`"$lc`">")
        [void]$lines.Add("    <langName>$ln</langName>")
        [void]$lines.Add("    <md5Hash>$mh</md5Hash>")
        [void]$lines.Add("    <summary>")
        [void]$lines.Add("      <countTotal>$($r.summary.countTotal)</countTotal>")
        [void]$lines.Add("      <countTranslated>$($r.summary.countTranslated)</countTranslated>")
        [void]$lines.Add("      <ratioTranslated>$($r.summary.ratioTranslated)</ratioTranslated>")
        [void]$lines.Add("    </summary>")
        [void]$lines.Add("  </language>")
    }
    [void]$lines.Add('</languages>')
    return ($lines -join "`n") + "`n"
}

# ── 输出 ──
$content = switch ($outExt) {
    "yaml" { ConvertTo-SummaryYaml $result }
    "xml"  { ConvertTo-SummaryXml $result }
    default { $result | ConvertTo-Json -Compress }
}
[System.IO.File]::WriteAllText($OutputFile, $content)
Write-Host "已生成: $OutputFile" -ForegroundColor Yellow
