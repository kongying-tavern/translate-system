export interface JsonSchemaField {
  name: string
  type: string
  required: boolean
  desc: string
  depth: number
}

export interface JsonSchema {
  type?: string | string[]
  description?: string
  default?: unknown
  enum?: unknown[]
  required?: string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  allOf?: JsonSchema[]
  $ref?: string
}

export type SchemaMap = Record<string, JsonSchema>

/** 沿 $ref 链解析到实际 schema（无法解析时返回原引用） */
export function resolveSchemaRef(schema: JsonSchema, schemas: SchemaMap): JsonSchema {
  let s = schema
  const seen = new Set<string>()
  while (s.$ref) {
    if (seen.has(s.$ref))
      break
    seen.add(s.$ref)
    const name = s.$ref.split('/').pop() ?? ''
    const target = schemas[name]
    if (!target)
      return s
    s = { ...target }
  }
  return s
}

function normalize(schema: JsonSchema, schemas: SchemaMap): JsonSchema {
  schema = resolveSchemaRef(schema, schemas)
  if (schema.allOf?.length) {
    const merged: JsonSchema = { type: 'object' }
    for (const sub of schema.allOf) {
      const m = normalize(sub, schemas)
      merged.properties = { ...merged.properties, ...m.properties }
      merged.required = [...(merged.required ?? []), ...(m.required ?? [])]
      if (m.description)
        merged.description = m.description
    }
    return merged
  }
  if (schema.oneOf?.length)
    return normalize(schema.oneOf[0], schemas)
  if (schema.anyOf?.length)
    return normalize(schema.anyOf[0], schemas)
  return schema
}

export function typeLabel(schema: JsonSchema, schemas: SchemaMap = {}): string {
  const s = normalize(schema, schemas)
  if (s.$ref)
    return s.$ref.split('/').pop() ?? 'object'
  if (s.enum)
    return s.enum.map(v => String(v)).join(' | ')
  const type = Array.isArray(s.type) ? s.type[0] : s.type
  if (type === 'array')
    return s.items ? `array<${typeLabel(s.items, schemas)}>` : 'array'
  return type ?? 'object'
}

/**
 * 将 JSON Schema 展平为字段表格行。
 * 传入根 schema 时 name 留空、depth 传 -1，只展开其 properties。
 * `schemas` 用于解析 `$ref`（对应 OpenAPI 的 components.schemas）。
 */
export function schemaToFields(schema: JsonSchema, name: string, required = false, depth = 0, schemas: SchemaMap = {}): JsonSchemaField[] {
  const s = normalize(schema, schemas)
  const fields: JsonSchemaField[] = []
  if (name && (depth > 0 || name === 'data'))
    fields.push({ name, type: typeLabel(s, schemas), required, desc: s.description ?? '', depth })
  if (s.properties) {
    for (const [propName, propSchema] of Object.entries(s.properties)) {
      const childRequired = s.required?.includes(propName) ?? false
      fields.push(...schemaToFields(propSchema, propName, childRequired, depth + 1, schemas))
    }
  }
  else if (s.items) {
    const item = normalize(s.items, schemas)
    if (item.properties) {
      for (const [propName, propSchema] of Object.entries(item.properties)) {
        const childRequired = item.required?.includes(propName) ?? false
        fields.push(...schemaToFields(propSchema, propName, childRequired, depth + 1, schemas))
      }
    }
  }
  return fields
}
