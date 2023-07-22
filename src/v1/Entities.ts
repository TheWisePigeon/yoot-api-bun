import Elysia from "elysia";
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

export default entities_v1
