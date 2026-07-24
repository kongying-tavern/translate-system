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
  local input; input=$(cat)
  [[ -z "$input" ]] && { echo ""; return 1; }
  node -e "
    var d = JSON.parse(process.argv[1]);
    var keys = process.argv[2].replace(/^\./, '').split('.');
    var v = d;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.endsWith('[]')) {
        v = v[k.slice(0, -2)];
        if (i + 1 < keys.length) {
          var rest = keys.slice(i + 1).join('.');
          v.forEach(function(x) { console.log(x[rest]); });
          process.exit(0);
        }
        v.forEach(function(x) { console.log(x); });
        process.exit(0);
      }
      v = v[k];
    }
    if (Array.isArray(v)) v.forEach(function(x) { console.log(x); });
    else console.log(v);
  " "$input" "$1" || echo ""
}

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

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
    *) echo -e "${RED}未知参数: $1${NC}"; usage ;;
  esac
done

DELETE_MODE="${DELETE_MODE:-file}"

for var in ENDPOINT PROJECT_SLUG API_KEY API_SECRET TEMPLATE_SLUG OUTPUT_DIR; do
  if [[ -z "${!var:-}" ]]; then echo -e "${RED}缺少必填参数: $var${NC}"; usage; fi
done

if ! command -v node &>/dev/null; then
  echo -e "${RED}错误: 需要 node 来解析 JSON 响应${NC}" >&2
  exit 1
fi

# ── 清理 ──
if [[ "${DELETE:-false}" = true ]]; then
  if [[ -d "$OUTPUT_DIR" ]]; then
    if [[ "$DELETE_MODE" = "folder" ]]; then
      rm -rf "$OUTPUT_DIR"
      echo -e "${YELLOW}已删除目录: $OUTPUT_DIR${NC}"
    else
      rm -f "$OUTPUT_DIR"/*.json
      echo -e "${YELLOW}已删除 $OUTPUT_DIR 下所有 .json 文件${NC}"
    fi
  fi
fi

mkdir -p "$OUTPUT_DIR"

# ── 获取项目语言列表 ──
if [[ -z "${LANGUAGES:-}" ]]; then
  echo -e "${CYAN}正在获取项目语言列表...${NC}"
  LANG_RESP=$(curl -s -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" \
    "$ENDPOINT/api/v1/apikey/projects/$PROJECT_SLUG/languages")
  if [[ -z "$LANG_RESP" ]]; then echo -e "${RED}获取语言列表失败: API 返回空响应${NC}"; exit 1; fi
  if [[ "$(echo "$LANG_RESP" | json_field '.code')" != "0" ]]; then
    echo -e "${RED}获取语言列表失败: $(echo "$LANG_RESP" | json_field '.message')${NC}"; exit 1
  fi
  LANGUAGES=$(echo "$LANG_RESP" | json_field '.data[].languageCode' | tr '\n' ',')
  LANGUAGES="${LANGUAGES%,}"
  if [[ -z "$LANGUAGES" ]]; then echo -e "${RED}项目没有配置任何语言${NC}"; exit 1; fi
  echo -e "${CYAN}发现语言: $LANGUAGES${NC}"
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
  [[ -z "$RESP" ]] && { echo -e "${RED} 错误: API 返回空响应${NC}"; ((FAILED++)); continue; }

  if [[ "$(echo "$RESP" | json_field '.code')" = "0" ]]; then
    echo "$RESP" | json_field '.data.content' > "$OUT_FILE"
    echo -e "${GREEN} -> $OUT_FILE ($(wc -c < "$OUT_FILE") 字节)${NC}"
    ((SUCCEEDED++))
  else
    echo -e "${RED} 错误: $(echo "$RESP" | json_field '.message')${NC}"
    ((FAILED++))
  fi
done

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${GREEN}完成: 成功 $SUCCEEDED, 失败 $FAILED${NC}"
else
  echo -e "${YELLOW}完成: 成功 $SUCCEEDED, 失败 $FAILED${NC}"
fi
