#!/bin/bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

usage() {
  cat <<EOF
用法: $0 <projectCode> <目录>

批量导入目录下所有 JSON 翻译文件到指定项目。

必填:
  projectCode           项目 Slug 或 Code（如 my-project）
  directory             包含 JSON 文件的目录路径

文件命名约定:
  文件名即为语言代码，例如 zh-Hans.json、en-US.json、ja-JP.json

示例:
  $0 my-project /app/translations
  $0 my-project ./translations
EOF
  exit 0
}

[[ $# -lt 2 ]] && usage

PROJECT=$1
DIR=$2

if [[ ! -d "$DIR" ]]; then
  echo -e "${RED}错误: 目录不存在: $DIR${NC}" >&2
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo -e "${RED}错误: 未找到 pnpm，请先安装 Node.js 和 pnpm${NC}" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
BACKEND_DIR="$SCRIPT_DIR/../backend"
cd "$BACKEND_DIR"

JSON_FILES=("$DIR"/*.json)
if [[ ! -e "${JSON_FILES[0]}" ]]; then
  echo -e "${RED}错误: 目录中没有 JSON 文件: $DIR${NC}" >&2
  exit 1
fi

echo -e "${CYAN}正在从 $DIR 导入 JSON 文件到项目 $PROJECT${NC}"
echo "--------------------"

SUCCEEDED=0
FAILED=0

for f in "$DIR"/*.json; do
  filename=$(basename "$f")
  lang="${filename%.json}"
  echo -e "${YELLOW}[$lang] 导入 $filename...${NC}"
  if pnpm tsx src/scripts/import-json.ts "$PROJECT" "$f" "$lang"; then
    echo -e "${GREEN}[$lang] 完成${NC}"
    ((++SUCCEEDED))
  else
    echo -e "${RED}[$lang] 失败${NC}"
    ((++FAILED))
  fi
done

echo "--------------------"
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${GREEN}全部导入完成: 成功 $SUCCEEDED, 失败 $FAILED${NC}"
else
  echo -e "${YELLOW}导入完成: 成功 $SUCCEEDED, 失败 $FAILED${NC}"
fi
