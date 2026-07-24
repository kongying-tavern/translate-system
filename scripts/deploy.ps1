param(
    [Parameter(Mandatory, HelpMessage = "服务器地址")]
    [string]$Host,

    [Parameter(HelpMessage = "SSH 端口")]
    [int]$Port = 22,

    [Parameter(Mandatory, HelpMessage = "SSH 用户名")]
    [string]$User,

    [Parameter(Mandatory, HelpMessage = "目标部署目录（服务器上的项目路径）")]
    [string]$Dir,

    [Parameter(Mandatory, HelpMessage = "发布分支")]
    [string]$Branch
)

$ErrorActionPreference = "Stop"
$dest = "${User}@${Host}"

Write-Host "===== 部署开始 =====" -ForegroundColor Cyan
Write-Host "服务器: ${Host}:${Port}"
Write-Host "用户:   ${User}"
Write-Host "目录:   ${Dir}"
Write-Host "分支:   ${Branch}"
Write-Host ""

# 1. 测试连接
Write-Host "[1/4] 测试 SSH 连接..." -ForegroundColor Yellow
ssh -p $Port $dest "echo OK" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "SSH 连接失败" -ForegroundColor Red; exit 1 }

# 2. 拉取代码
Write-Host "[2/4] 拉取代码..." -ForegroundColor Yellow
ssh -p $Port $dest "cd ${Dir} && git fetch origin && git checkout ${Branch} && git pull origin ${Branch}"
if ($LASTEXITCODE -ne 0) { Write-Host "拉取代码失败" -ForegroundColor Red; exit 1 }

# 3. 构建并启动
Write-Host "[3/4] 构建并启动 Docker 服务..." -ForegroundColor Yellow
ssh -p $Port $dest "cd ${Dir} && docker compose up -d --build"
if ($LASTEXITCODE -ne 0) { Write-Host "Docker 部署失败" -ForegroundColor Red; exit 1 }

# 4. 检查服务状态
Write-Host "[4/4] 检查服务状态..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
ssh -p $Port $dest "cd ${Dir} && docker compose ps" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "警告: 无法获取服务状态" -ForegroundColor Yellow }

Write-Host ""
Write-Host "===== 部署完成 =====" -ForegroundColor Green
