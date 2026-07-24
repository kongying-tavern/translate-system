#!/bin/bash
set -euo pipefail

usage() {
  cat <<EOF
用法: $0 [选项]

必填:
  -e, --endpoint <url>        服务器地址，如 http://localhost:20080
  -p, --project <slug>        项目 Slug (UUID 或 code)
  -k, --api-key <key>         API Key (ak_xxx)
  -s, --api-secret <secret>   API Secret
  -t, --template <slug>       导出模板 Slug (UUID 或 code)
  -o, --output <dir>          输出目录

可选:
  -l, --languages <list>      过滤语言，逗号分隔（如 zh-Hans,en-US），默认全部
  -d, --delete                导出前清理已有文件
  -m, --delete-mode <mode>    清理模式: file|folder (默认 file)
  -h, --help                  显示此帮助
EOF
  exit 0
}

json_field() {
  jq -r "$1" 2>/dev/null
}

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--endpoint)     ENDPOINT="$2"; shift 2 ;;
    -p|--project)      PROJECT_SLUG="$2"; shift 2 ;;
    -k|--api-key)      API_KEY="$2"; shift 2 ;;
    -s|--api-secret)   API_SECRET="$2"; shift 2 ;;
    -t|--template)     TEMPLATE_SLUG="$2"; shift 2 ;;
    -o|--output)       OUTPUT_DIR="$2"; shift 2 ;;
    -l|--languages)    LANGUAGES="$2"; shift 2 ;;
    -d|--delete)       DELETE=true; shift ;;
    -m|--delete-mode)  DELETE_MODE="$2"; shift 2 ;;
    -h|--help)         usage ;;
    *) echo "未知参数: $1"; usage ;;
  esac
done

DELETE_MODE="${DELETE_MODE:-file}"

for var in ENDPOINT PROJECT_SLUG API_KEY API_SECRET TEMPLATE_SLUG OUTPUT_DIR; do
  if [[ -z "${!var:-}" ]]; then echo "缺少必填参数: $var"; usage; fi
done

if ! command -v jq &>/dev/null; then
  echo "错误: 需要 jq 来解析 JSON 响应" >&2
  exit 1
fi

# ── 清理 ──
if [[ "${DELETE:-false}" = true ]]; then
  if [[ -d "$OUTPUT_DIR" ]]; then
    if [[ "$DELETE_MODE" = "folder" ]]; then
      rm -rf "$OUTPUT_DIR"
      echo "已删除目录: $OUTPUT_DIR"
    else
      rm -f "$OUTPUT_DIR"/*.json
      echo "已删除 $OUTPUT_DIR 下所有 .json 文件"
    fi
  fi
fi

mkdir -p "$OUTPUT_DIR"

# ── 获取项目语言列表 ──
if [[ -z "${LANGUAGES:-}" ]]; then
  echo "正在获取项目语言列表..."
  LANG_RESP=$(curl -s -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
    "$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/languages")
  if [[ "$(json_field '["code"]' <<< "$LANG_RESP")" != "0" ]]; then
    echo "获取语言列表失败: $(json_field '["message"]' <<< "$LANG_RESP")"; exit 1
  fi
  LANGUAGES=$(json_field '.data[].languageCode' <<< "$LANG_RESP" | tr '\n' ',')
  LANGUAGES="${LANGUAGES%,}"
  if [[ -z "$LANGUAGES" ]]; then echo "项目没有配置任何语言"; exit 1; fi
  echo "发现语言: $LANGUAGES"
fi

# ── 逐语言导出 ──
EXPORT_URL="$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/exports/generate"
SUCCEEDED=0
FAILED=0

IFS=',' read -ra LANG_ARRAY <<< "$LANGUAGES"
for LANG in "${LANG_ARRAY[@]}"; do
  LANG="${LANG// /}"
  [[ -z "$LANG" ]] && continue

  OUT_FILE="$OUTPUT_DIR/$LANG.json"
  echo -n "导出 $LANG ..."

  BODY="{\"templateSlug\":\"$TEMPLATE_SLUG\",\"languageCodes\":[\"$LANG\"],\"filterTags\":[]}"
  RESP=$(curl -s -X POST -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
    -H "Content-Type: application/json" -d "$BODY" "$EXPORT_URL")

  if [[ "$(json_field '["code"]' <<< "$RESP")" = "0" ]]; then
    json_field '.data.content' <<< "$RESP" > "$OUT_FILE"
    echo " -> $OUT_FILE ($(wc -c < "$OUT_FILE") 字节)"
    ((SUCCEEDED++))
  else
    echo " 错误: $(json_field '["message"]' <<< "$RESP")"
    ((FAILED++))
  fi
done

echo ""
echo "完成: 成功 $SUCCEEDED, 失败 $FAILED"
