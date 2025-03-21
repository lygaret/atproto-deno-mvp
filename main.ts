import { Router } from "jsr:@oak/oak/router";
import { Application } from "jsr:@oak/oak/application";
import { Session as OakSession } from "x/oak-sessions";

import { Agent } from "npm:@atproto/api";

import * as config from "./config.ts"
import { buildClient, OAuthClient } from "./lib/oauth-client.ts"

type AppState = {
  kv: Deno.Kv;
  oauth: OAuthClient;
  session?: OakSession;
  agent?: Agent;
};

const router = new Router<AppState>();

router.get("/", async (ctx, next) => {
  if (!ctx.state.agent)
    return await next();

  ctx.response.type = "application/json";
  ctx.response.body = await ctx.state.agent.com.atproto.repo.getRecord({
    repo: ctx.state.agent.assertDid,
    collection: "app.bsky.actor.profile",
    rkey: "self",
  });
});

router.get("/oauth/client-metadata.json", (ctx) => {
  ctx.response.type = "application/json";
  ctx.response.body = ctx.state.oauth.clientMetadata;
});

router.get("/oauth/callback", async (ctx) => {
  const params = ctx.request.url.searchParams;
  const tokens = await ctx.state.oauth.callback(params);
  ctx.state.session?.set("did", tokens.session.did);

  return ctx.response.redirect("/");
});

router.post("/oauth/login", async (ctx) => {
  const body   = await ctx.request.body.form();
  const handle = body.get("handle");
  if (typeof handle !== "string") {
    return ctx.response.redirect("?error=bad-handle");
  }

  const url = await ctx.state.oauth.authorize(handle);
  return ctx.response.redirect(url);
});

const kv    = await Deno.openKv();
const oauth = buildClient(kv, {
  responseMode: "query",
  clientMetadata: {
    client_name: "skypod",
    client_id:   config.oauth.client_id,
    scope: config.oauth.scope,
    redirect_uris: [config.oauth.redirect_uri],
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true
  }
})

const app = new Application<AppState>({
  contextState: "prototype",
  state: { kv, oauth }
});

app.use(OakSession.initMiddleware());
app.use(async (ctx, next) => {
  const did = ctx.state.session?.get("did") as string | null;
  if (did != null) {
    const tokens = await ctx.state.oauth.restore(did);
    ctx.state.agent = new Agent(tokens);
  }

  await next();
});
app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (ctx, next) => {
  try {
    await ctx.send({ root: `${Deno.cwd()}/public`, index: "index.html" });
  } catch {
    await next();
  }
});
app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = "not found";
});
app.addEventListener('error', (e) => {
  console.error('error in handler!', e);
  if (e.context) {
    e.context.response.status = 500;
    e.context.response.body   = 'oh no!';
  }
})

console.log("listening on http://localhost:7878");
app.listen({ port: 7878 });
