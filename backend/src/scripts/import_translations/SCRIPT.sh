#!/bin/bash
set -euo pipefail

usage() {
  cat <<EOF
用法: $0 [选项]

将翻译内容导入指定项目。

必填:
  -e, --endpoint <url>        服务器地址，如 http://localhost:20080
  -k, --api-key <key>         API Key (ak_xxx)
  -s, --api-secret <secret>   API Secret
  -p, --project-slug <slug>    项目 Slug (UUID 或 code)
  -t, --format-type <type>    格式类型，支持：
                                  json        JSON 格式
                                  csv         CSV 格式（多语言宽表）
                                  yaml        YAML 格式
                                  xml         XML 格式
                                  properties  Properties 格式
  -l, --language <code>       目标语言代码（如 zh-Hans，支持代码别名）
  -f, --file <path>           数据文件路径

可选:
  -a, --auth-config <file>    鉴权信息文件路径（JSON，包含 apiKey 和 apiSecret）
  -o, --overwrite             覆盖已有译文（默认不覆盖）
  -n, --no-auto-create        不自动补全新条目（默认自动创建）
  -h, --help                  显示此帮助
EOF
  exit 0
}

json_field() {
  jq -r "$1 // \"\"" 2>/dev/null || echo ""
}

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--endpoint)      ENDPOINT="$2"; shift 2 ;;
    -k|--api-key)       API_KEY="$2"; shift 2 ;;
    -s|--api-secret)    API_SECRET="$2"; shift 2 ;;
    -a|--auth-config)   AUTH_CONFIG="$2"; shift 2 ;;
    -p|--project-slug) PROJECT_SLUG="$2"; shift 2 ;;
    -t|--format-type)   FORMAT_TYPE="$2"; shift 2 ;;
    -l|--language)      LANGUAGE_CODE="$2"; shift 2 ;;
    -f|--file)          DATA_FILE="$2"; shift 2 ;;
    -o|--overwrite)     OVERWRITE=true; shift ;;
    -n|--no-auto-create) AUTO_CREATE=false; shift ;;
    -h|--help)          usage ;;
    *) echo -e "${RED}未知参数: $1${NC}"; usage ;;
  esac
done

# ── 加载配置文件 ──
if [[ -n "${AUTH_CONFIG:-}" ]]; then
  if [[ ! -f "$AUTH_CONFIG" ]]; then
    echo -e "${RED}错误: 鉴权文件不存在: $AUTH_CONFIG${NC}" >&2; exit 1
  fi
  AUTH_JSON=$(cat "$AUTH_CONFIG")
  AUTH_API_KEY=$(echo "$AUTH_JSON" | json_field '.apiKey')
  AUTH_API_SECRET=$(echo "$AUTH_JSON" | json_field '.apiSecret')
  [[ -z "${API_KEY:-}" && -n "$AUTH_API_KEY" ]] && API_KEY="$AUTH_API_KEY"
  [[ -z "${API_SECRET:-}" && -n "$AUTH_API_SECRET" ]] && API_SECRET="$AUTH_API_SECRET"
  echo -e "${YELLOW}已加载鉴权信息${NC}"
fi

for var in ENDPOINT PROJECT_SLUG API_KEY API_SECRET FORMAT_TYPE LANGUAGE_CODE DATA_FILE; do
  if [[ -z "${!var:-}" ]]; then echo -e "${RED}缺少必填参数: $var${NC}"; usage; fi
done

if [[ ! -f "$DATA_FILE" ]]; then
  echo -e "${RED}错误: 文件不存在: $DATA_FILE${NC}" >&2; exit 1
fi

if ! command -v jq &>/dev/null; then
  echo -e "${RED}错误: 需要 jq 来解析 JSON 响应${NC}" >&2; exit 1
fi

# ── 读取文件内容并发送请求 ──
DATA=$(cat "$DATA_FILE")
BODY=$(jq -n \
  --arg data "$DATA" \
  --arg formatType "$FORMAT_TYPE" \
  --arg languageCode "$LANGUAGE_CODE" \
  --argjson overwrite ${OVERWRITE:-false} \
  --argjson autoCreate ${AUTO_CREATE:-true} \
  '{data: $data, formatType: $formatType, languageCode: $languageCode, overwrite: $overwrite, autoCreate: $autoCreate}')

echo -e "${CYAN}正在导入翻译到项目 $PROJECT_SLUG（语言: $LANGUAGE_CODE，格式: $FORMAT_TYPE）...${NC}"

RESP=$(curl -s -X POST -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
  -H "Content-Type: application/json" -d "$BODY" \
  "$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/imports/translations")

if [[ "$(echo "$RESP" | json_field '.code')" = "0" ]]; then
  IMPORTED=$(echo "$RESP" | json_field '.data.imported')
  CREATED=$(echo "$RESP" | json_field '.data.created')
  SKIPPED=$(echo "$RESP" | json_field '.data.skipped')
  echo -e "${GREEN}导入完成: $IMPORTED 条，新增 $CREATED，跳过 $SKIPPED${NC}"
else
  echo -e "${RED}导入失败: $(echo "$RESP" | json_field '.message')${NC}" >&2
  exit 1
fi
