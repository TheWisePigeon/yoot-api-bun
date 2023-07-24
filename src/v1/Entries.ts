import Elysia from "elysia";
import { ApiKey, Permission, TypeParse, HttpResponse } from "../utils";
import sql from "../db";
import { string, z } from "zod";
import { stringify } from "querystring";

const setup = (app: Elysia) => app
  .state('api_key', {} as ApiKey)

const entries_v1 = (app: Elysia) => app
  .use(setup)
  .get('/entities/:entity/entries', async ({ params, store })=>{
    try {
      const { api_key:{ project }} = store
      const { entity } = params
      if(entity===""){
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const [targetted_entity] = await sql<{id:string}[]>` select id from entity where name=${entity} and project=${project}`
      if(!targetted_entity){
        return HttpResponse(404, "ERR_RESOURCE_NOT_FOUND")
      }
      const entries = await sql` select * from entry where entity=${targetted_entity.id}`
      return HttpResponse(
        200,
        JSON.stringify({
          data:entries
        })
      )
    } catch (err) {
      console.log(`Error while fetching entries in entity ${err}`)
      return HttpResponse(500)
    }
  })
  .delete('/entities/:entity/entries/:entry', async ({ params, store, request })=>{
    try {
      const content_type = (request.headers.get("Content-Type") as string).split(";")[0]
      if (content_type !== "multipart/form-data") {
        return HttpResponse(415, "ERR_CONT_TYPE")
      }
      const { api_key:{ permissions, project }} = store
      const parsed_permissions = JSON.parse(permissions) as Permission
      if(!parsed_permissions.delete_permission){
        return HttpResponse(403, "ERR_DELETE_PERMISSION")
      }
      const { entity, entry } = params
      if(entity==="" || entry===""){
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const [targetted_entity] = await sql<{id:string}[]>` select id from entity where name=${entity} and project=${project}`
      if(!targetted_entity){
        return HttpResponse(404, "ERR_RESOURCE_NOT_FOUND")
      }
      await sql` delete from entry where id=${entry} and entity=${targetted_entity.id}`
      return HttpResponse(200)
    } catch (err) {
      return HttpResponse(500)
    }
  })


export default entries_v1
