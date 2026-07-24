param(
    [string]$ProjectId = "f7b5aa13-de09-431e-9c7f-17e27331f689",
    [string]$ApiKey = "ak_d2e22b73781083f56fd08efb881ef5aa",
    [string]$ApiSecret = "0a192b22e6458c7ccfe7f9d467c95a4b721893b72730b74d",
    [string]$Server = "http://localhost:8080",
    [string]$TemplateSlug = "0f9909e8-9458-4749-88cf-5afdd3d22444",
    [string[]]$Languages = @("zh-Hans"),
    [string[]]$Tags = @(),
    [string]$OutputFile = "translations.json"
)

$body = @{
    templateSlug   = $TemplateSlug
    languageCodes  = $Languages
}
if ($Tags.Count -gt 0) { $body.filterTags = $Tags }

$headers = @{
    "x-api-key"    = $ApiKey
    "x-api-secret" = $ApiSecret
    "Content-Type" = "application/json"
}

$url = "$Server/api/v1/apikey/projects/$ProjectId/exports/generate"
Write-Host "Exporting from: $url" -ForegroundColor Cyan
Write-Host "Languages: $($Languages -join ', ')" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body ($body | ConvertTo-Json)
    if ($response.code -eq 0) {
        $extension = if ($response.data.format -eq "csv") { "csv" } elseif ($response.data.format -eq "xml") { "xml" } else { "json" }
        $outFile = "$OutputFile.$extension" -replace '\.json\.json$', '.json'
        $response.data.content | Out-File -FilePath $outFile -Encoding utf8
        Write-Host "Exported $($response.data.content.Length) chars -> $outFile" -ForegroundColor Green
    } else {
        Write-Host "Error: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}
