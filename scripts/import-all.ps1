param(
    [string]$ProjectCode,
    [string]$Directory
)

if (-not $ProjectCode -or -not $Directory) {
    Write-Host "Usage: .\import-all.ps1 <projectCode> <directory>"
    Write-Host "Example: .\import-all.ps1 my-project C:\translations\"
    exit 1
}

Write-Host "Importing all JSON files from $Directory to project $ProjectCode" -ForegroundColor Cyan
Write-Host "--------------------"

Get-ChildItem "$Directory\*.json" | ForEach-Object {
    $lang = $_.BaseName
    Write-Host "[$lang] Importing $_..." -ForegroundColor Yellow
    pnpm tsx src/scripts/import-json.ts $ProjectCode $_.FullName $lang
    Write-Host "[$lang] Done." -ForegroundColor Green
}

Write-Host "--------------------"
Write-Host "All imports complete." -ForegroundColor Cyan
