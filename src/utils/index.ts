import { z, ZodSchema } from "zod"
export function TypeParse<T extends ZodSchema<any>>( element: unknown, schema: T ) : element is z.infer<T> {
  try {
    schema.parse(element)
    return true
  } catch (_) {
    return false
  }
}

export function HttpResponse(status: number = 200, data?: string) {
  return new Response(data, { status })
}

export type ApiKey = {
  id: string,
  name: string,
  project: string,
  permissions: string,
  key: string,
  owner: string
}

export type Permission = {
  create_permission: boolean,
  write_permission: boolean,
  delete_permission: boolean
}

export const Types = ["Text", "Number", "Boolean", "Image"]

export function entity_data_is_valid(fields: string[], types: string[]) {
  if (fields.length === 0 || types.length === 0) return {
    status: false, message: "An entity can not have an empty schema"
  }
  if (
    (new Set(fields)).size !== fields.length
  ) return {
    status: false, message: "An entity can not have two fields of the same name"
  }
  const invalid_type = types.find(field_type => !Types.includes(field_type))
  if (invalid_type) return {
    status: false, message: `Invalid or unsupported type ${invalid_type}`
  }
  return {
    status: true, message: ""
  }
}
