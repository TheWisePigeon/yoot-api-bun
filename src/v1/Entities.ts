import Elysia from "elysia";
import { ApiKey, Permission, entity_data_is_valid, TypeParse } from "../utils";
import sql from "../db";
import { HttpResponse } from "../utils";
import { z } from "zod";

const setup = (app: Elysia) => app
  .state('api_key', {} as ApiKey)


const entities_v1 = (app: Elysia) => app
  .use(setup)
  .get('/entities', async ({ store: { api_key } }) => {
    try {
      const { project } = api_key
      const entities = await sql` select * from entity where project=${project}`
      return HttpResponse(
        200,
        JSON.stringify({ entities })
      )
    } catch (err) {
      console.log(`Error while getting list of entities ${err}`)
      return HttpResponse(500)
    }
  })
  .post('/entities', async ({ store, body, request }) => {
    try {
      const content_type = (request.headers.get("Content-Type") as string).split(";")[0]
      if(content_type!=="multipart/form-data"){
        return HttpResponse(415, "ERR_CONT_TYPE")
      }
      if (TypeParse(body, z.object({ name: z.string(), schema: z.string() }))) {
        const { api_key: { permissions, project } } = store
        const parsed_permissions = JSON.parse(permissions) as Permission
        if (!parsed_permissions.create_permission) {
          return HttpResponse(403, "ERR_CREATE_PERMISSION")
        }
        const { name, schema } = body
        const [potential_duplicate] = await sql` select name from entity where name=${name} and project=${project}`
        if (potential_duplicate) {
          return HttpResponse(409, "ERR_DUPLICATE")
        }
        if (name === "") return HttpResponse(400, "ERR_EMPTY_NAME")
        let parsed_schema: Record<string, string>
        parsed_schema = JSON.parse(schema) as Record<string, string>
        let [fields, types] = Object.entries(parsed_schema)
        const { status, message } = entity_data_is_valid(fields, types)
        if (!status) return HttpResponse(400, message)
        await sql`
        insert into entity(name, project, schema)
        values(${name}, ${""}, ${schema})
      `
        return HttpResponse(201)

      } else {
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "SyntaxError") {
          return HttpResponse(400, "ERR_BAD_SCHEMA")
        }
      }
      console.log(`Error while creating entity ${err}`)
      return HttpResponse(500)
    }
  })

export default entities_v1
