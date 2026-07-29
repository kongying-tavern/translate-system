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
  -o, --output <dir>          输出目录

可选:
  -a, --auth-config <file>    鉴权信息文件路径（JSON，包含 apiKey 和 apiSecret）
  -l, --languages <list>      过滤语言，逗号分隔（如 zh-Hans,en-US），默认全部
  -g, --filter-tags <list>    按标签过滤，逗号分隔，只导出含指定标签的条目
  -n, --no-alias              不使用语言别名作为文件名，改用语言代码
  -d, --delete                写文件前若有则删除（file 模式）或导出前删整个目录（folder 模式）
  -m, --delete-mode <mode>    清理模式: file|folder (默认 file)
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
FILTER_TAGS=""

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--endpoint)     ENDPOINT="$2"; shift 2 ;;
    -k|--api-key)      API_KEY="$2"; shift 2 ;;
    -s|--api-secret)   API_SECRET="$2"; shift 2 ;;
    -a|--auth-config)  AUTH_CONFIG="$2"; shift 2 ;;
    -p|--project)      PROJECT_SLUG="$2"; shift 2 ;;
    -t|--template)     TEMPLATE_SLUG="$2"; shift 2 ;;
    -o|--output)       OUTPUT_DIR="$2"; shift 2 ;;
    -l|--languages)    LANGUAGES="$2"; shift 2 ;;
    -g|--filter-tags)  FILTER_TAGS="$2"; shift 2 ;;
    -n|--no-alias)     NO_ALIAS=true; shift ;;
    -d|--delete)       DELETE=true; shift ;;
    -m|--delete-mode)  DELETE_MODE="$2"; shift 2 ;;
    -h|--help)         usage ;;
    *) echo -e "${RED}未知参数: $1${NC}"; usage ;;
  esac
done

DELETE_MODE="${DELETE_MODE:-file}"

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

for var in ENDPOINT PROJECT_SLUG API_KEY API_SECRET TEMPLATE_SLUG OUTPUT_DIR; do
  if [[ -z "${!var:-}" ]]; then echo -e "${RED}缺少必填参数: $var${NC}"; usage; fi
done

if ! command -v jq &>/dev/null; then
  echo -e "${RED}错误: 需要 jq 来解析 JSON 响应${NC}" >&2
  exit 1
fi

if [[ "${DELETE:-false}" = true && "$DELETE_MODE" = "folder" && -d "$OUTPUT_DIR" ]]; then
  rm -rf "$OUTPUT_DIR"
  echo -e "${YELLOW}已删除目录: $OUTPUT_DIR${NC}"
fi

mkdir -p "$OUTPUT_DIR"

# ── 获取项目语言列表 ──
echo -e "${CYAN}正在获取项目语言列表...${NC}"
LANG_RESP=$(curl -s -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
  "$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/languages")
if [[ -z "$LANG_RESP" ]]; then echo -e "${RED}获取语言列表失败: API 返回空响应${NC}"; exit 1; fi
if [[ "$(echo "$LANG_RESP" | json_field '.code')" != "0" ]]; then
  echo -e "${RED}获取语言列表失败: $(echo "$LANG_RESP" | json_field '.message')${NC}"; exit 1
fi

declare -A ALIAS_MAP CODE_MAP IS_CODE
ALL_CODES=()
LANG_LIST=$(jq -r '.data[] | "\(.languageCode)|\(.alias // "")"' <<< "$LANG_RESP")
while IFS='|' read -r code alias; do
  ALL_CODES+=("$code")
  IS_CODE["$code"]=1
  if [[ -n "$alias" ]]; then
    ALIAS_MAP["$code"]="$alias"
    CODE_MAP["$alias"]="$code"
  fi
done <<< "$LANG_LIST"
if [[ ${#ALL_CODES[@]} -eq 0 ]]; then echo -e "${RED}项目没有配置任何语言${NC}"; exit 1; fi

# 解析目标语言（支持 code 和 alias 匹配）
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
    elif [[ -n "${CODE_MAP[$entry]:-}" ]]; then
      LANG_CODES+=("${CODE_MAP[$entry]}")
    else
      echo -e "${YELLOW}警告: 未匹配到语言: $entry${NC}"
    fi
  done
fi
if [[ ${#LANG_CODES[@]} -eq 0 ]]; then echo -e "${RED}没有匹配的语言可供导出${NC}"; exit 1; fi
echo -e "${CYAN}发现语言: ${LANG_CODES[*]}${NC}"

# ── 模板检查 ──
DOWNLOADABLE_FORMATS="flat-json,nested-json,flat-yaml,nested-yaml,properties,flat-xml,nested-xml,csv"
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
  echo -e "${RED}错误: 模板格式 '$TMPL_FORMAT' 不适用于逐语言下载${NC}" >&2
  echo -e "${YELLOW}支持的格式: $DOWNLOADABLE_FORMATS${NC}" >&2
  exit 1
fi

# ── 逐语言导出 ──
EXPORT_URL="$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/exports/generate"
SUCCEEDED=0
FAILED=0

for CODE in "${LANG_CODES[@]}"; do
  CODE="${CODE// /}"
  [[ -z "$CODE" ]] && continue

  if [[ "${NO_ALIAS:-false}" = "true" ]]; then
    NAME="$CODE"
  else
    NAME="${ALIAS_MAP[$CODE]:-$CODE}"
  fi

  echo -n "导出 $CODE ..."

  TAG_LIST=$(echo "$FILTER_TAGS" | awk -F',' '{for(i=1;i<=NF;i++){gsub(/^[[:space:]]+|[[:space:]]+$/,"",$i); if($i!=""){printf "\"%s\"",$i; if(i<NF)printf ","}}}')
  [[ -n "$TAG_LIST" ]] && TAG_LIST="[$TAG_LIST]" || TAG_LIST="[]"
  BODY="{\"templateSlug\":\"$TEMPLATE_SLUG\",\"languageCodes\":[\"$CODE\"],\"filterTags\":$TAG_LIST}"
  RESP=$(curl -s -X POST -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
    -H "Content-Type: application/json" -d "$BODY" "$EXPORT_URL")
  [[ -z "$RESP" ]] && { echo -e "${RED} 错误: API 返回空响应${NC}"; ((++FAILED)); continue; }

  if [[ "$(echo "$RESP" | json_field '.code')" = "0" ]]; then
    FORMAT=$(echo "$RESP" | json_field '.data.format')
    ENCODING=$(echo "$RESP" | json_field '.data.encoding')
    OUT_FILE="$OUTPUT_DIR/$NAME.$FORMAT"
    if [[ "${DELETE:-false}" = true && "$DELETE_MODE" = "file" && -f "$OUT_FILE" ]]; then
      rm -f "$OUT_FILE"
      echo -e "${YELLOW}已删除旧文件: $OUT_FILE${NC}"
    fi
    if [[ "$ENCODING" = "base64" ]]; then
      jq -j '.data.content // ""' <<< "$RESP" | base64 -d > "$OUT_FILE"
    else
      jq -j '.data.content // ""' <<< "$RESP" > "$OUT_FILE"
    fi
    echo -e "${GREEN} -> $OUT_FILE ($(wc -c < "$OUT_FILE") 字节)${NC}"
    ((++SUCCEEDED))
  else
    echo -e "${RED} 错误: $(echo "$RESP" | json_field '.message')${NC}"
    ((++FAILED))
  fi
done

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${GREEN}完成: 成功 $SUCCEEDED, 失败 $FAILED${NC}"
else
  echo -e "${YELLOW}完成: 成功 $SUCCEEDED, 失败 $FAILED${NC}"
fi
