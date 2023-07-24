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
        JSON.stringify({ data: entities })
      )
    } catch (err) {
      console.log(`Error while getting list of entities ${err}`)
      return HttpResponse(500)
    }
  })
  .post('/entities', async ({ store, body, request }) => {
    try {
      const content_type = (request.headers.get("Content-Type") as string).split(";")[0]
      if (content_type !== "multipart/form-data") {
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
        let fields = Object.keys(parsed_schema)
        let types = Object.values(parsed_schema)
        const { status, message } = entity_data_is_valid(fields, types)
        if (!status) return HttpResponse(400, message)
        await sql`
          insert into entity(name, project, schema)
          values(${name}, ${project}, ${sql.json(parsed_schema)})
        `
        return HttpResponse(201)
      } else {
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
    } catch (err) {
      console.log(err)
      if (err instanceof Error) {
        if (err.name === "SyntaxError") {
          return HttpResponse(400, "ERR_BAD_SCHEMA")
        }
      }
      console.log(`Error while creating entity ${err}`)
      return HttpResponse(500)
    }
  })
  .put('/entities/:name', async ({ store, body, request, params }) => {
    try {
      const { name } = params
      if(name===""){
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const content_type = (request.headers.get("Content-Type") as string).split(";")[0]
      if (content_type !== "multipart/form-data") {
        return HttpResponse(415, "ERR_CONT_TYPE")
      }
      const { api_key:{ permissions, project }} = store
      const parsed_permissions = JSON.parse(permissions) as Permission
      if(!parsed_permissions.write_permission){
        return HttpResponse(403, "ERR_WRITE_PERMISSION")
      }
      const [targetted_entity] = await sql<{id:string}[]>` select id from entity where name=${name} and project=${project}`
      if(!targetted_entity){
        return HttpResponse(404, "ERR_RESOURCE_NOT_FOUND")
      }
      if (TypeParse(body, z.object({ name: z.string() }))) {
        const [potential_duplicate] = await sql` select name from entity where name=${body.name} and project=${project}`
        if(potential_duplicate){
          return HttpResponse(409, "ERR_CONFLICT")
        }
        await sql` update entity set name=${body.name} where id=${targetted_entity.id}`
        return HttpResponse(200)
      } else {
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
    } catch (err) {
      console.log(`Error while updating entity ${err}`)
      return HttpResponse(500)
    }
  })
  .delete('/entities/:name', async ({ store, request, params })=>{
    try {
      const { name } = params
      if(name===""){
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const content_type = (request.headers.get("Content-Type") as string).split(";")[0]
      if (content_type !== "multipart/form-data") {
        return HttpResponse(415, "ERR_CONT_TYPE")
      }
      const { api_key:{ permissions, project }} = store
      const parsed_permissions = JSON.parse(permissions) as Permission
      if(!parsed_permissions.write_permission){
        return HttpResponse(403, "ERR_WRITE_PERMISSION")
      }
      const [targetted_entity] = await sql<{id:string}[]>` select id from entity where name=${name} and project=${project}`
      if(!targetted_entity){
        return HttpResponse(404, "ERR_RESOURCE_NOT_FOUND")
      }
      await sql`delete from entity where id=${targetted_entity.id}`
      return HttpResponse(200)
    } catch (err) {
      console.log(`Error while updating entity ${err}`)
      return HttpResponse(500)
    }
  })

export default entities_v1
