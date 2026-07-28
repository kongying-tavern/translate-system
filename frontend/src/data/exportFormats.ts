export enum ExportFormat {
  FlatJson = 'flat-json',
  NestedJson = 'nested-json',
  FlatYaml = 'flat-yaml',
  NestedYaml = 'nested-yaml',
  FlatXml = 'flat-xml',
  NestedXml = 'nested-xml',
  Properties = 'properties',
  Csv = 'csv',
}

export interface ExportFormatMeta {
  format: string
  tags: string[]
}

export const EXPORT_FORMAT_MAP: Record<ExportFormat, ExportFormatMeta> = {
  [ExportFormat.FlatJson]: { format: 'json', tags: ['单语言', 'K-V 映射'] },
  [ExportFormat.NestedJson]: { format: 'json', tags: ['多语言', 'K-V 映射'] },
  [ExportFormat.FlatYaml]: { format: 'yaml', tags: ['单语言', 'K-V 映射'] },
  [ExportFormat.NestedYaml]: { format: 'yaml', tags: ['多语言', 'K-V 映射'] },
  [ExportFormat.Properties]: { format: 'properties', tags: ['单语言', '键值对'] },
  [ExportFormat.FlatXml]: { format: 'xml', tags: ['单语言', '标签结构'] },
  [ExportFormat.NestedXml]: { format: 'xml', tags: ['多语言', '标签结构'] },
  [ExportFormat.Csv]: { format: 'csv', tags: ['多语言', '表格'] },
}

export function getFormatMeta(formatType: ExportFormat): ExportFormatMeta {
  return EXPORT_FORMAT_MAP[formatType] || { format: formatType, tags: [] }
}
