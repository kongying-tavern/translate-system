#!/bin/bash
set -euo pipefail

CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

usage() {
  cat <<EOF
用法: $0 --target <目录> <命令> [选项]

伪锁定方案：在临时目录中处理文件，完成后同步到目标目录。
避免目标目录出现中间状态文件。

命令:
  lock [--delete]    锁定目标目录，创建临时目录
                     --delete: 清空目标目录后再创建临时目录
  unlock [--delete]  解锁并同步文件到目标目录
                     缺省为复制；--delete 为移动（从临时目录中删除原文件）
  status             查看锁定状态

参数:
  --target <目录>    目标目录（必填）
  --delete           见各命令说明
  --help, -h         显示此帮助

使用流程:
  1. lock        → 创建临时目录，输出路径
  2. 在临时目录中执行任务（将输出指向临时目录）
  3. unlock      → 同步到目标目录

示例:
  STAGING=\$(./SCRIPT.sh --target ./translations lock --delete)
  ./scripts/download_translations_single.sh \\
    -e http://localhost:20080 -k ak_xxx -s xxx \\
    -p my-project -t my-template -o "\$STAGING"
  ./scripts/summarize_translations.sh \\
    -e http://localhost:20080 -k ak_xxx -s xxx \\
    -p my-project -i "\$STAGING" -o "\$STAGING/summary.json"
  ./SCRIPT.sh --target ./translations unlock --delete
EOF
  exit 0
}

TARGET_DIR=""
COMMAND=""
DELETE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target|-t) TARGET_DIR="$2"; shift 2 ;;
    --delete|-d) DELETE="true"; shift ;;
    --help|-h) usage ;;
    lock|unlock|status) COMMAND="$1"; shift ;;
    *) echo "错误: 未知参数: $1" >&2; usage ;;
  esac
done

if [[ -z "$TARGET_DIR" ]]; then
  echo "错误: 需要 --target <目录>" >&2; exit 1
fi
if [[ -z "$COMMAND" ]]; then
  echo "错误: 需要指定命令 (lock|unlock|status)" >&2; exit 1
fi

LOCK_FILE="$TARGET_DIR/.staging_lock"

case "$COMMAND" in
  lock)
    if [[ -f "$LOCK_FILE" ]]; then
      existing=$(cat "$LOCK_FILE")
      echo -e "${RED}错误: 目标目录已锁定 (临时目录: $existing)${NC}" >&2
      echo -e "${RED}如要强制重建，请先运行: $0 --target $TARGET_DIR unlock${NC}" >&2
      exit 1
    fi
    if [[ -n "$DELETE" && -d "$TARGET_DIR" ]]; then
      rm -rf "${TARGET_DIR:?}/"*
    fi
    mkdir -p "$TARGET_DIR"
    STAGING_DIR=$(mktemp -d -t "staging.XXXXXX")
    echo "$STAGING_DIR" > "$LOCK_FILE"
    echo -e "${CYAN}已锁定: $TARGET_DIR → $STAGING_DIR${NC}" >&2
    echo "$STAGING_DIR"
    ;;

  unlock)
    if [[ ! -f "$LOCK_FILE" ]]; then
      echo -e "${RED}错误: 目标目录未锁定${NC}" >&2
      exit 1
    fi
    STAGING_DIR=$(cat "$LOCK_FILE")
    if [[ ! -d "$STAGING_DIR" ]]; then
      echo -e "${RED}错误: 临时目录不存在: $STAGING_DIR${NC}" >&2
      rm -f "$LOCK_FILE"
      exit 1
    fi
    echo -e "${CYAN}同步文件到: $TARGET_DIR${NC}" >&2
    shopt -s dotglob nullglob
    for f in "$STAGING_DIR"/*; do
      [ -e "$f" ] || continue
      if [[ -n "$DELETE" ]]; then
        mv -f "$f" "$TARGET_DIR/"
      else
        cp -f "$f" "$TARGET_DIR/"
      fi
    done
    shopt -u dotglob nullglob
    rm -f "$LOCK_FILE"
    if [[ -n "$DELETE" ]]; then
      rm -rf "$STAGING_DIR"
    fi
    echo -e "${CYAN}已解锁: $STAGING_DIR → $TARGET_DIR${NC}" >&2
    ;;

  status)
    if [[ -f "$LOCK_FILE" ]]; then
      echo "locked: $(cat "$LOCK_FILE")"
    else
      echo "unlocked"
    fi
    ;;
esac
