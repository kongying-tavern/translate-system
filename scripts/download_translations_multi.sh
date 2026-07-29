#!/bin/bash
set -euo pipefail

usage() {
  cat <<EOF
用法: $0 [选项]

必填:
  -e, --endpoint <url>        服务器地址，如 http://localhost:20080
  -k, --api-key <key>         API Key (ak_xxx)
  -s, --api-secret <secret>   API Secret
  -p, --project <slug>        项目 Slug (UUID 或 code)
  -t, --template <slug>       导出模板 Slug (UUID 或 code)
  -o, --output <file>         输出文件路径

可选:
  -a, --auth-config <file>    鉴权信息文件路径（JSON，包含 apiKey 和 apiSecret）
  -l, --languages <list>      过滤语言，逗号分隔（如 zh-Hans,en-US），默认全部
  -g, --filter-tags <list>    按标签过滤，逗号分隔，只导出含指定标签的条目
  -d, --delete                导出前删除已存在的输出文件
  -h, --help                  显示此帮助
EOF
  exit 0
}

json_field() {
  jq -r "$1 // \"\"" 2>/dev/null || echo ""
}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--endpoint)     ENDPOINT="$2"; shift 2 ;;
    -k|--api-key)      API_KEY="$2"; shift 2 ;;
    -s|--api-secret)   API_SECRET="$2"; shift 2 ;;
    -a|--auth-config)  AUTH_CONFIG="$2"; shift 2 ;;
    -p|--project)      PROJECT_SLUG="$2"; shift 2 ;;
    -t|--template)     TEMPLATE_SLUG="$2"; shift 2 ;;
    -o|--output)       OUTPUT_FILE="$2"; shift 2 ;;
    -l|--languages)    LANGUAGES="$2"; shift 2 ;;
    -g|--filter-tags)  FILTER_TAGS="$2"; shift 2 ;;
    -d|--delete)       DELETE=true; shift ;;
    -h|--help)         usage ;;
    *) echo -e "${RED}未知参数: $1${NC}"; usage ;;
  esac
done

# ── 加载配置文件 ──
if [[ -n "${AUTH_CONFIG:-}" ]]; then
  if [[ ! -f "$AUTH_CONFIG" ]]; then
    echo -e "${RED}错误: 鉴权文件不存在: $AUTH_CONFIG${NC}" >&2
    exit 1
  fi
  AUTH_JSON=$(cat "$AUTH_CONFIG")
  AUTH_API_KEY=$(echo "$AUTH_JSON" | json_field '.apiKey')
  AUTH_API_SECRET=$(echo "$AUTH_JSON" | json_field '.apiSecret')
  [[ -z "${API_KEY:-}" && -n "$AUTH_API_KEY" ]] && API_KEY="$AUTH_API_KEY"
  [[ -z "${API_SECRET:-}" && -n "$AUTH_API_SECRET" ]] && API_SECRET="$AUTH_API_SECRET"
  echo -e "${YELLOW}已加载鉴权信息${NC}"
fi

for var in ENDPOINT PROJECT_SLUG API_KEY API_SECRET TEMPLATE_SLUG OUTPUT_FILE; do
  if [[ -z "${!var:-}" ]]; then echo -e "${RED}缺少必填参数: $var${NC}"; usage; fi
done

if ! command -v jq &>/dev/null; then
  echo -e "${RED}错误: 需要 jq 来解析 JSON 响应${NC}" >&2
  exit 1
fi

# ── 删除已存在的输出文件 ──
if [[ "${DELETE:-false}" = true && -f "$OUTPUT_FILE" ]]; then
  rm -f "$OUTPUT_FILE"
  echo -e "${YELLOW}已删除旧文件: $OUTPUT_FILE${NC}"
fi

# ── 获取项目语言列表 ──
echo -e "${CYAN}正在获取项目语言列表...${NC}"
LANG_RESP=$(curl -s -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
  "$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/languages")
if [[ -z "$LANG_RESP" ]]; then echo -e "${RED}获取语言列表失败: API 返回空响应${NC}"; exit 1; fi
if [[ "$(echo "$LANG_RESP" | json_field '.code')" != "0" ]]; then
  echo -e "${RED}获取语言列表失败: $(echo "$LANG_RESP" | json_field '.message')${NC}"; exit 1
fi

declare -A IS_CODE
ALL_CODES=()
LANG_LIST=$(jq -r '.data[] | "\(.languageCode)|\(.alias // "")"' <<< "$LANG_RESP")
while IFS='|' read -r code alias; do
  ALL_CODES+=("$code")
  IS_CODE["$code"]=1
done <<< "$LANG_LIST"
if [[ ${#ALL_CODES[@]} -eq 0 ]]; then echo -e "${RED}项目没有配置任何语言${NC}"; exit 1; fi

# 解析目标语言（仅支持 code 匹配）
LANG_CODES=()
if [[ -z "${LANGUAGES:-}" ]]; then
  LANG_CODES=("${ALL_CODES[@]}")
else
  IFS=',' read -ra FILTER_LIST <<< "$LANGUAGES"
  for entry in "${FILTER_LIST[@]}"; do
    entry="${entry// /}"
    [[ -z "$entry" ]] && continue
    if [[ -n "${IS_CODE[$entry]:-}" ]]; then
      LANG_CODES+=("$entry")
    else
      echo -e "${YELLOW}警告: 未匹配到语言: $entry${NC}"
    fi
  done
fi
if [[ ${#LANG_CODES[@]} -eq 0 ]]; then echo -e "${RED}没有匹配的语言可供导出${NC}"; exit 1; fi
echo -e "${CYAN}发现语言: ${LANG_CODES[*]}${NC}"

# ── 模板检查 ──
DOWNLOADABLE_FORMATS="nested-json,nested-yaml,nested-xml,csv"
TEMPLATE_URL="$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/exports/templates/$TEMPLATE_SLUG"
TMPL_RESP=$(curl -s -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" "$TEMPLATE_URL")
TMPL_CODE=$(echo "$TMPL_RESP" | json_field '.code')
if [[ "$TMPL_CODE" != "0" ]]; then
  TMPL_MSG=$(echo "$TMPL_RESP" | json_field '.message')
  echo -e "${RED}获取模板信息失败: $TMPL_MSG${NC}" >&2
  exit 1
fi
TMPL_FORMAT=$(echo "$TMPL_RESP" | json_field '.data.formatType')
VALID=false
IFS=',' read -ra FMTS <<< "$DOWNLOADABLE_FORMATS"
for f in "${FMTS[@]}"; do
  [[ "$f" == "$TMPL_FORMAT" ]] && { VALID=true; break; }
done
if ! $VALID; then
  echo -e "${RED}错误: 模板格式 '$TMPL_FORMAT' 不适用于多语言导出${NC}" >&2
  echo -e "${YELLOW}支持的格式: $DOWNLOADABLE_FORMATS${NC}" >&2
  exit 1
fi

# ── 一次性导出全部语言 ──
EXPORT_URL="$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/exports/generate"
LANG_LIST=$(IFS=','; echo "${LANG_CODES[*]}")
TAG_LIST=$(echo "$FILTER_TAGS" | awk -F',' '{for(i=1;i<=NF;i++){gsub(/^[[:space:]]+|[[:space:]]+$/,"",$i); if($i!=""){printf "\"%s\"",$i; if(i<NF)printf ","}}}')
[[ -n "$TAG_LIST" ]] && TAG_LIST="[$TAG_LIST]" || TAG_LIST="[]"
BODY="{\"templateSlug\":\"$TEMPLATE_SLUG\",\"languageCodes\":[\"${LANG_CODES[*]// /\",\"}\"],\"filterTags\":$TAG_LIST}"
echo -n "导出全部语言到 ${OUTPUT_FILE}..."

RESP=$(curl -s -X POST -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
  -H "Content-Type: application/json" -d "$BODY" "$EXPORT_URL")
[[ -z "$RESP" ]] && { echo -e "${RED} 错误: API 返回空响应${NC}"; exit 1; }

if [[ "$(echo "$RESP" | json_field '.code')" = "0" ]]; then
  ENCODING=$(echo "$RESP" | json_field '.data.encoding')
  if [[ "$ENCODING" = "base64" ]]; then
    jq -j '.data.content // ""' <<< "$RESP" | base64 -d > "$OUTPUT_FILE"
  else
    jq -j '.data.content // ""' <<< "$RESP" > "$OUTPUT_FILE"
  fi
  echo -e "${GREEN} -> $OUTPUT_FILE ($(wc -c < "$OUTPUT_FILE") 字节)${NC}"
  echo -e "${GREEN}完成${NC}"
else
  echo -e "${RED} 错误: $(echo "$RESP" | json_field '.message')${NC}"
  exit 1
fi
