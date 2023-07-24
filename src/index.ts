import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors"
import { HttpResponse, ApiKey } from "./utils";
import { API_KEY_PREFIX } from "./config";
import sql from "./db";
import entities_v1 from "./v1/Entities";
import entries_v1 from "./v1/Entries";

const app = new Elysia()

app.use(cors())

app.get('/health', ()=>{
  return HttpResponse(200)
})

app.group(
  '/v1', app => app
    .state('api_key', {})
    .onBeforeHandle(async ({ headers, store }) => {
      try {
        const api_key = headers["authorization"] ?? ""
        if (api_key == "") {
          return HttpResponse(401, "ERR_MISSING_KEY")
        }
        const splitted_key = api_key.split("$")
        if (splitted_key.length !== 2) {
          return HttpResponse(401, "ERR_INVALID_KEY")
        }
        const [partial_id, key] = splitted_key
        const db_id = `${API_KEY_PREFIX}_${partial_id}`
        const [db_key] = await sql<ApiKey[]>` select * from api_key where id=${db_id}`
        if (!db_key) {
          return HttpResponse(401, "ERR_INVALID_KEY")
        }
        const key_matches = await Bun.password.verify(key, db_key.key, "bcrypt")
        if (!key_matches) {
          return HttpResponse(401, "ERR_INVALID_KEY")
        }
        store.api_key = db_key
      } catch (err) {
        return HttpResponse(500)
      }
    })
    .use(entities_v1)
    .use(entries_v1)
)

app.listen(3000, async () => {
  const version = await sql` select version() `
  console.log(version)
})
