#!/bin/bash
set -euo pipefail

usage() {
  cat <<EOF
用法: $0 [选项]

必填:
  -h, --host <addr>     服务器地址
  -P, --port <port>     SSH 端口（默认 22）
  -u, --user <name>     SSH 用户名
  -d, --dir <path>      目标部署目录（服务器上的项目路径）
  -b, --branch <name>   发布分支

可选:
  --help                显示此帮助
EOF
  exit 0
}

# 默认值
PORT=22

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--host)   HOST="$2"; shift 2 ;;
    -P|--port)   PORT="$2"; shift 2 ;;
    -u|--user)   USER="$2"; shift 2 ;;
    -d|--dir)    DIR="$2"; shift 2 ;;
    -b|--branch) BRANCH="$2"; shift 2 ;;
    --help)      usage ;;
    *) echo "未知参数: $1"; usage ;;
  esac
done

for var in HOST USER DIR BRANCH; do
  if [[ -z "${!var:-}" ]]; then echo "缺少必填参数: $var"; usage; fi
done

SSH_DEST="${USER}@${HOST}"
SSH_CMD="ssh -p ${PORT} ${SSH_DEST}"

echo "===== 部署开始 ====="
echo "服务器: ${HOST}:${PORT}"
echo "用户:   ${USER}"
echo "目录:   ${DIR}"
echo "分支:   ${BRANCH}"
echo ""

# 测试连接
echo "[1/4] 测试 SSH 连接..."
$SSH_CMD "echo OK" || { echo "SSH 连接失败"; exit 1; }

# 拉取代码
echo "[2/4] 拉取代码..."
$SSH_CMD "cd ${DIR} && git fetch origin && git checkout ${BRANCH} && git pull origin ${BRANCH}" || { echo "拉取代码失败"; exit 1; }

# 构建并启动
echo "[3/4] 构建并启动 Docker 服务..."
$SSH_CMD "cd ${DIR} && docker compose up -d --build" || { echo "Docker 部署失败"; exit 1; }

# 检查服务状态
echo "[4/4] 检查服务状态..."
sleep 5
$SSH_CMD "cd ${DIR} && docker compose ps" || echo "警告: 无法获取服务状态"

echo ""
echo "===== 部署完成 ====="
