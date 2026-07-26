export interface ExportFormatMeta {
  format: string
  tags: string[]
}

export const EXPORT_FORMAT_MAP: Record<string, ExportFormatMeta> = {
  'flat-json': { format: 'json', tags: ['单语言', 'K-V 映射'] },
  'nested-json': { format: 'json', tags: ['多语言', 'K-V 映射'] },
  'flat-yaml': { format: 'yaml', tags: ['单语言', 'K-V 映射'] },
  'nested-yaml': { format: 'yaml', tags: ['多语言', 'K-V 映射'] },
  'csv': { format: 'csv', tags: ['多语言', '表格'] },
  'properties': { format: 'properties', tags: ['单语言', '键值对'] },
  'xml': { format: 'xml', tags: ['多语言', '标签结构'] },
  'xlsx': { format: 'xlsx', tags: ['多语言', '表格', '二进制'] },
}

export function getFormatMeta(formatType: string): ExportFormatMeta {
  return EXPORT_FORMAT_MAP[formatType] || { format: formatType, tags: [] }
}
