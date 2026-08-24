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

可选:
  -a, --auth-config <file>    鉴权信息文件路径（JSON，包含 apiKey 和 apiSecret）
  -l, --languages <list>      过滤语言，逗号分隔，支持 code 或 alias，不传则全部
  -g, --filter-tags <list>    按标签过滤，逗号分隔，只统计含指定标签的条目
  -n, --no-alias              文件名和输出的 langCode 使用语言代码而非别名
  -f, --input-format <type>   输入文件类型: json, yaml, xml, properties, csv（默认 json）
  -t, --output-format <type>  输出文件类型: json, yaml, xml（默认 json）
  -i, --input-dir <dir>       包含翻译文件的目录（必填）
  -o, --output <file>         输出文件路径（默认 <input-dir>/summary.json）
  -h, --help                  显示此帮助
EOF
  exit 0
}

ENDPOINT=""
API_KEY=""
API_SECRET=""
PROJECT_SLUG=""
INPUT_DIR=""
AUTH_CONFIG=""
LANGUAGES=""
FILTER_TAGS=""
NO_ALIAS=""
INPUT_FORMAT="json"
OUTPUT_FORMAT="json"
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--endpoint)      ENDPOINT="$2"; shift 2 ;;
    -k|--api-key)       API_KEY="$2"; shift 2 ;;
    -s|--api-secret)    API_SECRET="$2"; shift 2 ;;
    -a|--auth-config)   AUTH_CONFIG="$2"; shift 2 ;;
    -p|--project)       PROJECT_SLUG="$2"; shift 2 ;;
    -i|--input-dir)     INPUT_DIR="$2"; shift 2 ;;
    -l|--languages)     LANGUAGES="$2"; shift 2 ;;
    -g|--filter-tags)   FILTER_TAGS="$2"; shift 2 ;;
    -n|--no-alias)      NO_ALIAS="true"; shift ;;
    -f|--input-format)  INPUT_FORMAT="$2"; shift 2 ;;
    -t|--output-format) OUTPUT_FORMAT="$2"; shift 2 ;;
    -o|--output)        OUTPUT="$2"; shift 2 ;;
    -h|--help)          usage ;;
    *) echo "未知参数: $1"; usage ;;
  esac
done

VALID_INPUT_EXTS="json yaml xml properties csv"
VALID_OUTPUT_EXTS="json yaml xml"

if [[ ! " $VALID_INPUT_EXTS " =~ " $INPUT_FORMAT " ]]; then
  echo "错误: 不支持的输入文件类型: $INPUT_FORMAT（可选: $VALID_INPUT_EXTS）" >&2; exit 1
fi
if [[ ! " $VALID_OUTPUT_EXTS " =~ " $OUTPUT_FORMAT " ]]; then
  echo "错误: 不支持的输出文件类型: $OUTPUT_FORMAT（可选: $VALID_OUTPUT_EXTS）" >&2; exit 1
fi
IN_EXT="$INPUT_FORMAT"
OUT_EXT="$OUTPUT_FORMAT"

if ! command -v jq &>/dev/null; then echo "错误: 需要 jq" >&2; exit 1; fi
if { [[ "$IN_EXT" == "yaml" || "$OUT_EXT" == "yaml" ]] && ! command -v yq &>/dev/null; } then
  echo "错误: YAML 格式需要 yq" >&2; exit 1
fi
if { [[ "$IN_EXT" == "xml" || "$OUT_EXT" == "xml" ]] && ! command -v xmlstarlet &>/dev/null; } then
  echo "错误: XML 格式需要 xmlstarlet" >&2; exit 1
fi

# ── 加载鉴权配置 ──
if [[ -n "$AUTH_CONFIG" ]]; then
  if [[ ! -f "$AUTH_CONFIG" ]]; then echo "错误: 鉴权文件不存在: $AUTH_CONFIG" >&2; exit 1; fi
  if [[ -z "$API_KEY" ]]; then API_KEY=$(jq -r '.apiKey // ""' "$AUTH_CONFIG"); fi
  if [[ -z "$API_SECRET" ]]; then API_SECRET=$(jq -r '.apiSecret // ""' "$AUTH_CONFIG"); fi
  echo "已加载鉴权信息" >&2
fi

if [[ -z "$ENDPOINT" || -z "$API_KEY" || -z "$API_SECRET" || -z "$PROJECT_SLUG" || -z "$INPUT_DIR" ]]; then
  echo "错误: 缺少必填参数（-e/-k/-s/-p/-i 或 -a）" >&2; exit 1
fi
if [[ ! -d "$INPUT_DIR" ]]; then echo "错误: 目录不存在: $INPUT_DIR" >&2; exit 1; fi

API_BASE="${ENDPOINT%/}/api/v1/apikey"

# ── 获取项目语言列表 ──
echo "正在获取项目语言列表..." >&2
LANGS_RAW=$(curl -s -X GET "$API_BASE/projects/$PROJECT_SLUG/languages" \
  -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET")

# ── 获取总 key 数 ──
echo "正在获取翻译总数..." >&2
COUNT_URL="$API_BASE/projects/$PROJECT_SLUG/translations/count"
[[ -n "$FILTER_TAGS" ]] && COUNT_URL+="?tags=$(echo "$FILTER_TAGS" | tr -d ' ' | sed 's/,/%2C/g')"
COUNT_RESP=$(curl -s -X GET "$COUNT_URL" \
  -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET")
TOTAL=$(jq -r '.data.total // 0' <<< "$COUNT_RESP")
echo "总条目数: $TOTAL" >&2

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="${INPUT_DIR%/}/summary.$OUT_EXT"
fi

# 构建配置 JSON
CONFIG_JSON=$(jq -n -c \
  --arg inputDir "$INPUT_DIR" \
  --arg inExt "$IN_EXT" \
  --arg outExt "$OUT_EXT" \
  --arg total "${TOTAL:-0}" \
  --arg noAlias "${NO_ALIAS:-false}" \
  --arg langFilter "$LANGUAGES" \
  --arg outputFile "$OUTPUT" \
  --argjson langData "${LANGS_RAW:-null}" \
  '{
    inputDir: $inputDir,
    inExt: $inExt,
    outExt: $outExt,
    total: ($total | tonumber),
    noAlias: ($noAlias == "true"),
    langFilter: (if $langFilter == "" then [] else ($langFilter | split(",") | map(sub("^ +";"") | sub(" +$";"")) | map(select(. != ""))) end),
    outputFile: $outputFile,
    langData: $langData
  }')

# ── 解析配置 ──
INPUT_DIR=$(jq -r '.inputDir' <<< "$CONFIG_JSON")
IN_EXT=$(jq -r '.inExt' <<< "$CONFIG_JSON")
OUT_EXT=$(jq -r '.outExt' <<< "$CONFIG_JSON")
TOTAL=$(jq -r '.total' <<< "$CONFIG_JSON")
NO_ALIAS=$(jq -r '.noAlias' <<< "$CONFIG_JSON")
OUTPUT_FILE=$(jq -r '.outputFile' <<< "$CONFIG_JSON")
LANG_FILTER=$(jq -r '.langFilter // []' <<< "$CONFIG_JSON")

# ── 解析语言列表 ──
LANG_LIST=$(jq -r '.langData.data // .langData | .[] | "\(.languageCode)|\(.codeAlias // "")"' <<< "$CONFIG_JSON")
[[ -z "$LANG_LIST" ]] && { echo "没有可处理的语言" >&2; exit 1; }

# 如果指定了 langFilter，用 jq 过滤（支持 code 和 alias 匹配）
if [[ "$LANG_FILTER" != "[]" ]]; then
  TARGETS=$(jq -r --argjson filter "$LANG_FILTER" \
    '[.langData.data // .langData | .[] | select(. as $l | $filter | index($l.languageCode) or (if $l.codeAlias then index($l.codeAlias) else false end)) | "\(.languageCode)|\(.codeAlias // "")"] | .[]' \
    <<< "$CONFIG_JSON")
else
  TARGETS="$LANG_LIST"
fi
[[ -z "$TARGETS" ]] && { echo "没有可处理的语言" >&2; exit 1; }

# ── 逐语言处理 ──
xml_esc() { sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g'; }

RESULT_JSON="["
FIRST=true

while IFS='|' read -r code alias; do
  logicLangCode="$code"
  [[ "$NO_ALIAS" != "true" && -n "$alias" ]] && logicLangCode="$alias"

  if [[ -n "$FILTER_TAGS" ]]; then
    # 标签过滤模式：使用 API 获取已翻译数
    LC_QUERY=$(printf '%s' "$code" | jq -sRr @uri)
    TAG_QUERY=$(echo "$FILTER_TAGS" | tr -d ' ' | sed 's/,/%2C/g')
    LC_RESP=$(curl -s -X GET "$API_BASE/projects/$PROJECT_SLUG/translations/count?languageCode=$LC_QUERY&tags=$TAG_QUERY" \
      -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET")
    TRANSLATED=$(echo "$LC_RESP" | jq -r '.data.translated // 0')
    [[ -z "$TRANSLATED" || "$TRANSLATED" = "null" ]] && { echo "错误: 获取语言 $code 统计失败" >&2; continue; }
    MD5=""
    RATIO=0
    if [[ "$TOTAL" -gt 0 ]]; then
      RATIO=$(awk "BEGIN{printf \"%.8f\", $TRANSLATED / $TOTAL * 100}")
    fi
  else
    file="${INPUT_DIR}/${logicLangCode}.${IN_EXT}"
    if [[ ! -f "$file" ]]; then
      echo "文件不存在，跳过: $file" >&2
      continue
    fi

    TRANSLATED=0
    VALUES=""

    case "$IN_EXT" in
      json)
        VALUES=$(jq -r 'to_entries[] | select(.value != null) | .value' "$file")
        TRANSLATED=$(jq -r '[to_entries[] | select(.value != null and .value != "")] | length' "$file")
        ;;
      yaml)
        VALUES=$(yq eval '. | to_entries[] | select(.value != null and .value != "") | .value' "$file" 2>/dev/null)
        TRANSLATED=$(yq eval '[. | to_entries[] | select(.value != null and .value != "")] | length' "$file" 2>/dev/null)
        ;;
      xml)
        VALUES=$(xmlstarlet sel -t -m "//string" -v "text()" -n "$file" 2>/dev/null | sed '/^[[:space:]]*$/d')
        TRANSLATED=$(echo "$VALUES" | grep -c . 2>/dev/null || echo 0)
        ;;
      properties)
        VALUES=$(grep -v '^[#!]' "$file" | grep '=' 2>/dev/null | sed 's/^[^=]*=//' | sed 's/\\([nrt])/\\1/g' | grep -v '^[[:space:]]*$')
        TRANSLATED=$(echo "$VALUES" | grep -c . 2>/dev/null || echo 0)
        ;;
      csv)
        VALUES=$(awk -F',' 'NR>1 {
          val = $NF
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", val)
          if (val != "") print val
        }' "$file" 2>/dev/null)
        TRANSLATED=$(echo "$VALUES" | grep -c . 2>/dev/null || echo 0)
        ;;
    esac

    MD5=$(echo "$VALUES" | LC_ALL=C sort | md5sum | cut -d' ' -f1)
    RATIO=0
    if [[ "$TOTAL" -gt 0 ]]; then
      RATIO=$(awk "BEGIN{printf \"%.8f\", $TRANSLATED / $TOTAL * 100}")
    fi
  fi

  ITEM=$(jq -n -c \
    --arg langName "$code" \
    --arg langCode "$logicLangCode" \
    --arg md5Hash "$MD5" \
    --argjson countTotal "$TOTAL" \
    --argjson countTranslated "$TRANSLATED" \
    --argjson ratio "$RATIO" \
    '{
      langName: $langName,
      langCode: $langCode,
      md5Hash: $md5Hash,
      summary: {
        countTotal: $countTotal,
        countTranslated: $countTranslated,
        ratioTranslated: $ratio
      }
    }')

  [[ "$FIRST" == "true" ]] && FIRST=false || RESULT_JSON+=","
  RESULT_JSON+="$ITEM"
done <<< "$TARGETS"
RESULT_JSON+="]"

# ── 输出结果 ──
case "$OUT_EXT" in
  yaml)
    echo "$RESULT_JSON" | yq eval -P - > "$OUTPUT_FILE"
    ;;
  xml)
    {
      printf '<?xml version="1.0" encoding="UTF-8"?>\n<languages>\n'
      echo "$RESULT_JSON" | jq -r '.[] | [.langCode, .langName, .md5Hash, (.summary.countTotal|tostring), (.summary.countTranslated|tostring), (.summary.ratioTranslated|tostring)] | @tsv' | \
      while IFS=$'\t' read -r lc ln md5 ct ctr rt; do
        printf '  <language code="%s">\n    <langName>%s</langName>\n    <md5Hash>%s</md5Hash>\n    <summary>\n      <countTotal>%s</countTotal>\n      <countTranslated>%s</countTranslated>\n      <ratioTranslated>%s</ratioTranslated>\n    </summary>\n  </language>\n' \
          "$(echo "$lc" | xml_esc)" "$(echo "$ln" | xml_esc)" "$md5" "$ct" "$ctr" "$rt"
      done
      printf '</languages>\n'
    } > "$OUTPUT_FILE"
    ;;
  *)
    printf '%s' "$RESULT_JSON" > "$OUTPUT_FILE"
    ;;
esac

echo "已生成: $OUTPUT_FILE" >&2
