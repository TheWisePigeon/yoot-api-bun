import Elysia, { t } from "elysia";
import { ApiKey } from "../utils";
import sql from "../db";
import { HttpResponse } from "../utils";

const setup = (app: Elysia) => app
  .state('api_key', {} as ApiKey)


const entities_v1 = (app: Elysia) => app
  .use(setup)
  .get('/entities', async ({ store:{ api_key }})=>{
    try {
      const { project } = api_key
      const entities = await sql` select * from entity where project=${project}`
      return HttpResponse(
        200,
        JSON.stringify({ entities })
      )
    } catch (err) {
      console.log(err)
      return HttpResponse(500)
    }
  })
  .post('/entities', async ({ store, body, headers })=>{
    try {
      const content_type = (headers["content-type"]! as string).split(";")[0]
      if(content_type!=="multipart/form-data") return HttpResponse(415, "ERR_BAD_CONTENT_TYPE")
      const { name, schema } = body
      if(name==="") return HttpResponse(400, "ERR_EMPTY_NAME")
      let parsed_schema : Record<string, string>
      try {
        parsed_schema = JSON.parse(schema) as Record<string, string>
        let fields = Object.entries(parsed_schema)
      } catch (_) {
        return HttpResponse(400, "ERR_BAD_SCHEMA")
      }
    } catch (err) {
      console.log(`Error while creating entity ${err}`)
      return HttpResponse(500)
    }
  }, {
    body: t.Object({
      name: t.String(),
      schema: t.String()
    })
  })

export default entities_v1
