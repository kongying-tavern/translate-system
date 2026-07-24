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

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--host)   HOST="$2"; shift 2 ;;
    -P|--port)   PORT="$2"; shift 2 ;;
    -u|--user)   USER="$2"; shift 2 ;;
    -d|--dir)    DIR="$2"; shift 2 ;;
    -b|--branch) BRANCH="$2"; shift 2 ;;
    --help)      usage ;;
    *) echo -e "${RED}未知参数: $1${NC}"; usage ;;
  esac
done

for var in HOST USER DIR BRANCH; do
  if [[ -z "${!var:-}" ]]; then echo -e "${RED}缺少必填参数: $var${NC}"; usage; fi
done

SSH_DEST="${USER}@${HOST}"
SSH_CMD="ssh -p ${PORT} ${SSH_DEST}"

echo -e "${CYAN}===== 部署开始 =====${NC}"
echo "服务器: ${HOST}:${PORT}"
echo "用户:   ${USER}"
echo "目录:   ${DIR}"
echo "分支:   ${BRANCH}"
echo ""

# 测试连接
echo -e "${YELLOW}[1/4] 测试 SSH 连接...${NC}"
$SSH_CMD "echo OK" || { echo -e "${RED}SSH 连接失败${NC}"; exit 1; }

# 拉取代码
echo -e "${YELLOW}[2/4] 拉取代码...${NC}"
$SSH_CMD "cd ${DIR} && git fetch origin && git checkout ${BRANCH} && git pull origin ${BRANCH}" || { echo -e "${RED}拉取代码失败${NC}"; exit 1; }

# 构建并启动
echo -e "${YELLOW}[3/4] 构建并启动 Docker 服务...${NC}"
$SSH_CMD "cd ${DIR} && docker compose up -d --build" || { echo -e "${RED}Docker 部署失败${NC}"; exit 1; }

# 检查服务状态
echo -e "${YELLOW}[4/4] 检查服务状态...${NC}"
sleep 5
$SSH_CMD "cd ${DIR} && docker compose ps" || echo -e "${YELLOW}警告: 无法获取服务状态${NC}"

echo ""
echo -e "${GREEN}===== 部署完成 =====${NC}"
