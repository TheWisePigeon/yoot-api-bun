import Elysia from "elysia";
import { ApiKey, Permission, HttpResponse } from "../utils";
import sql from "../db";
import { FileBlob } from "bun";
import { MEDIA_API_URL } from "../config";

const setup = (app: Elysia) => app
  .state('api_key', {} as ApiKey)

const entries_v1 = (app: Elysia) => app
  .use(setup)
  .get('/entities/:entity_name/entries', async ({ params, store }) => {
    try {
      const { api_key: { project } } = store
      const { entity_name } = params
      if (entity_name === "") {
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const [targetted_entity] = await sql<{ id: string }[]>` select id from entity where name=${entity_name} and project=${project}`
      if (!targetted_entity) {
        return HttpResponse(404, "ERR_RESOURCE_NOT_FOUND")
      }
      const entries = await sql` select * from entry where entity=${targetted_entity.id}`
      return HttpResponse(
        200,
        JSON.stringify({
          data: entries
        })
      )
    } catch (err) {
      console.log(`Error while fetching entries in entity ${err}`)
      return HttpResponse(500)
    }
  })
  .delete('/entities/:entity_name/entries/:entry', async ({ params, store, request }) => {
    try {
      const content_type = (request.headers.get("Content-Type") as string).split(";")[0]
      if (content_type !== "multipart/form-data") {
        return HttpResponse(415, "ERR_CONT_TYPE")
      }
      const { api_key: { permissions, project } } = store
      const parsed_permissions = JSON.parse(permissions) as Permission
      if (!parsed_permissions.delete_permission) {
        return HttpResponse(403, "ERR_DELETE_PERMISSION")
      }
      const { entity_name, entry } = params
      if (entity_name === "" || entry === "") {
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const [targetted_entity] = await sql<{ id: string }[]>` select id from entity where name=${entity_name} and project=${project}`
      if (!targetted_entity) {
        return HttpResponse(404, "ERR_RESOURCE_NOT_FOUND")
      }
      await sql` delete from entry where id=${entry} and entity=${targetted_entity.id}`
      return HttpResponse(200)
    } catch (err) {
      return HttpResponse(500)
    }
  })
  .post('/entities/:entity_name/entries', async ({ params, store, body, request }) => {
    try {
      const content_type = (request.headers.get("Content-Type") as string).split(";")[0]
      if (content_type !== "multipart/form-data") {
        return HttpResponse(415, "ERR_CONT_TYPE")
      }
      const { api_key: { permissions, project } } = store
      const parsed_permissions = JSON.parse(permissions) as Permission
      if (!parsed_permissions.create_permission) {
        return HttpResponse(403, "ERR_CREATE_PERMISSION")
      }
      const { entity_name } = params
      if (entity_name === "") {
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const [{ id, schema }] = await sql<{ id: string, name: string, project: string, schema: Record<string, string> }[]>` select * from entity where name=${entity_name} and project=${project}`
      if (!id) {
        return HttpResponse(404, "ERR_RESOURCE_NOT_FOUND")
      }
      let received_entry_value = body as Record<string, string | FileBlob>
      const field_names = Object.keys(received_entry_value)
      const valid_number_of_fields = field_names.length === Object.keys(schema).length
      const keys_match_schema = field_names.every(
        field => Object.keys(schema).includes(field)
      )
      if (
        !(
          valid_number_of_fields && keys_match_schema
        )
      ) {
        return HttpResponse(400, "ERR_BAD_REQUEST")
      }
      const fields = Object.entries(schema)
      let entry_value: Record<string, string> = {}
      for (const [field_name, field_type] of fields) {
        const data = received_entry_value[field_name]
        if (field_type === "Text") {
          if (typeof data !== "string") {
            return HttpResponse(400, "ERR_WRONG_FIELD_TYPE")
          }
          entry_value[field_name] = data
        }
        if (field_type === "Number") {
          if (typeof data !== "number") {
            return HttpResponse(400, "ERR_WRONG_FIELD_TYPE")
          }
          entry_value[field_name] = data
        }
        if (field_type === "Boolean") {
          if (typeof data !== "boolean") {
            return HttpResponse(400, "ERR_WRONG_FIELD_TYPE")
          }
          entry_value[field_name] = data
        }
        if (field_type === "Image") {
          try {
            const image = data as FileBlob
            if(!image.type){
              return HttpResponse(400, "ERR_EXPECTED_IMAGE")
            }
            const image_extension = image.type.split("/")[1]
            const form_data = new FormData()
            form_data.append('file_extension', image_extension)
            form_data.append('file_data', image)
            const response = await fetch(
              MEDIA_API_URL,
              {
                method: "POST",
                body: form_data
              }
            )
            if (response.status !== 200) {
              return HttpResponse(500, "ERR_IMAGE_UPLOAD")
            }
            const { url } = await response.json() as { url: string }
            entry_value[field_name] = url
          } catch (err) {
            console.log(err)
            return HttpResponse(500)
          }
        }
      }
      await sql` 
      insert into entry(entity, value)
      values(${id}, ${sql.json(entry_value)})
      `
      return HttpResponse(201)

    } catch (err) {
      return HttpResponse(500)
    }
  })


export default entries_v1
