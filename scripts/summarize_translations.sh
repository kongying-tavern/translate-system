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

# ── 加载鉴权配置 ──
if [[ -n "$AUTH_CONFIG" ]]; then
  if [[ ! -f "$AUTH_CONFIG" ]]; then echo "错误: 鉴权文件不存在: $AUTH_CONFIG" >&2; exit 1; fi
  if [[ -z "$API_KEY" ]]; then API_KEY=$(node -p "JSON.parse(require('fs').readFileSync('$AUTH_CONFIG','utf-8')).apiKey||''"); fi
  if [[ -z "$API_SECRET" ]]; then API_SECRET=$(node -p "JSON.parse(require('fs').readFileSync('$AUTH_CONFIG','utf-8')).apiSecret||''"); fi
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
TOTAL=$(curl -s -X GET "$API_BASE/projects/$PROJECT_SLUG/translations/count" \
  -H "x-api-key: $API_KEY" -H "x-api-secret: $API_SECRET" | node -e "var d='';process.stdin.on('data',function(c){d+=c});process.stdin.on('end',function(){try{console.log(JSON.parse(d).data.total||0)}catch(e){console.log(0)}})" || echo 0)
echo "总条目数: $TOTAL" >&2

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="${INPUT_DIR%/}/summary.$OUT_EXT"
fi

# 构建配置 JSON 传给 node
CONFIG_JSON=$(node -e "console.log(JSON.stringify({
  inputDir: process.argv[2],
  inExt: process.argv[3],
  outExt: process.argv[4],
  total: parseInt(process.argv[5],10)||0,
  noAlias: process.argv[6]==='true',
  langFilter: process.argv[7]?process.argv[7].split(',').map(function(s){return s.trim()}).filter(Boolean):[],
  outputFile: process.argv[8],
  langData: JSON.parse(process.argv[9]||'[]')
}))" "$INPUT_DIR" "$IN_EXT" "$OUT_EXT" "$TOTAL" "${NO_ALIAS:-false}" "$LANGUAGES" "$OUTPUT" "$LANGS_RAW")

node /dev/stdin "$CONFIG_JSON" <<'NODEJS'
var fs = require('fs');
var crypto = require('crypto');
var cfg = JSON.parse(process.argv[2]);

var langList = (cfg.langData.data || cfg.langData).map(function(l){
  return { code: l.languageCode, alias: l.alias || l.languageCode };
});

var aliasToCode = {};
langList.forEach(function(l){ if (l.alias !== l.code) aliasToCode[l.alias] = l.code; });

var targets = [];
if (cfg.langFilter.length > 0) {
  cfg.langFilter.forEach(function(f){
    var found = langList.filter(function(x){ return x.code === f; });
    if (found.length > 0) { targets.push(found[0]); return; }
    var code = aliasToCode[f];
    if (code) { targets.push(langList.filter(function(x){ return x.code === code; })[0]); return; }
    console.error('跳过未找到的语言: ' + f);
  });
} else {
  targets = langList;
}
if (targets.length === 0) { console.error('没有可处理的语言'); process.exit(1); }

function parseJSON(text) { return JSON.parse(text); }
function parseYAML(text) {
  var obj = {};
  text.split(/\r?\n/).forEach(function(line){
    var m = line.match(/^\s*([^#:]+?):\s*(.*)/);
    if (!m) return;
    var k = m[1].trim();
    var v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    obj[k] = v;
  });
  return obj;
}
function parseXML(text) {
  function decode(s) {
    return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,function(_,c){return String.fromCharCode(c)});
  }
  var obj = {};
  var re = /<string\s+name="([^"]*)"[^>]*>(.*?)<\/string>/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    var val = m[2];
    var cd = val.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
    obj[m[1]] = decode(cd ? cd[1] : val);
  }
  return obj;
}
function parseProperties(text) {
  function unescape(s) {
    return s.replace(/\\(.)/g, function(_,c){ return c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c; });
  }
  var obj = {};
  text.split(/\r?\n/).forEach(function(line){
    line = line.trim();
    if (!line || line[0] === '#' || line[0] === '!') return;
    var idx = line.indexOf('=');
    if (idx < 0) idx = line.indexOf(':');
    if (idx < 0) return;
    obj[line.slice(0, idx).trim()] = unescape(line.slice(idx + 1).trim());
  });
  return obj;
}
function parseCSV(text) {
  var obj = {};
  var lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return obj;
  var headers = parseCSVLine(lines[0]);
  var keyIdx = headers.indexOf('key');
  var valIdx = headers.length - 1;
  keyIdx = keyIdx >= 0 ? keyIdx : 0;
  for (var i = 1; i < lines.length; i++) {
    var row = parseCSVLine(lines[i]);
    if (row.length > keyIdx) obj[row[keyIdx]] = row.length > valIdx ? row[valIdx] : '';
  }
  return obj;
}
function parseCSVLine(line) {
  var result = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQ) { if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else { inQ = false; } } else { cur += c; } }
    else if (c === '"') { inQ = true; }
    else if (c === ',') { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

var PARSERS = { json: parseJSON, yaml: parseYAML, xml: parseXML, properties: parseProperties, csv: parseCSV };
var parseInput = PARSERS[cfg.inExt] || parseJSON;

var result = [];
targets.forEach(function(lang){
  var logicLangCode = cfg.noAlias ? lang.code : (lang.alias || lang.code);
  var filePath = cfg.inputDir + '/' + logicLangCode + '.' + cfg.inExt;
  if (!fs.existsSync(filePath)) { console.error('文件不存在，跳过: ' + filePath); return; }
  var content = parseInput(fs.readFileSync(filePath, 'utf-8'));
  var keys = Object.keys(content);
  var translated = 0;
  var texts = [];
  keys.forEach(function(k){
    var v = content[k];
    if (v && v.trim()) { translated++; texts.push(v.trim()); }
  });
  texts.sort();
  var md5Hash = crypto.createHash('md5').update(texts.join('')).digest('hex');
  result.push({
    langName: lang.code,
    langCode: logicLangCode,
    md5Hash: md5Hash,
    summary: {
      countTotal: cfg.total,
      countTranslated: translated,
      ratioTranslated: cfg.total > 0 ? Number((translated / cfg.total * 100).toFixed(8)) : 0
    }
  });
});

function serializeToYAML(data) {
  var lines = [];
  data.forEach(function(r){
    lines.push('- langName: ' + JSON.stringify(r.langName));
    lines.push('  langCode: ' + JSON.stringify(r.langCode));
    lines.push('  md5Hash: ' + JSON.stringify(r.md5Hash));
    lines.push('  summary:');
    lines.push('    countTotal: ' + r.summary.countTotal);
    lines.push('    countTranslated: ' + r.summary.countTranslated);
    lines.push('    ratioTranslated: ' + r.summary.ratioTranslated);
  });
  return lines.join('\n') + '\n';
}
function serializeToXML(data) {
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  var lines = ['<?xml version="1.0" encoding="UTF-8"?>','<languages>'];
  data.forEach(function(r){
    lines.push('  <language code="' + esc(r.langCode) + '">');
    lines.push('    <langName>' + esc(r.langName) + '</langName>');
    lines.push('    <md5Hash>' + esc(r.md5Hash) + '</md5Hash>');
    lines.push('    <summary>');
    lines.push('      <countTotal>' + r.summary.countTotal + '</countTotal>');
    lines.push('      <countTranslated>' + r.summary.countTranslated + '</countTranslated>');
    lines.push('      <ratioTranslated>' + r.summary.ratioTranslated + '</ratioTranslated>');
    lines.push('    </summary>');
    lines.push('  </language>');
  });
  lines.push('</languages>');
  return lines.join('\n') + '\n';
}
var outContent = '';
if (cfg.outExt === 'yaml') outContent = serializeToYAML(result);
else if (cfg.outExt === 'xml') outContent = serializeToXML(result);
else outContent = JSON.stringify(result);
fs.writeFileSync(cfg.outputFile, outContent, 'utf-8');
console.error('已生成: ' + cfg.outputFile);
NODEJS
