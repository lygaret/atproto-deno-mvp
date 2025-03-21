import { Router } from "jsr:@oak/oak/router";
import { Application } from "jsr:@oak/oak/application";
import { Session as OakSession } from "x/oak-sessions";

import { Agent } from "npm:@atproto/api";
import { OAuthClient } from "npm:@atproto/oauth-client";
import { AtprotoHandleResolver } from "npm:@atproto-labs/handle-resolver";

import { DenoKvStore } from "./lib/kv-store.ts";
import DenoRuntimeImpl from "./lib/oauth-runtime-impl.ts";

const kv = await Deno.openKv();
const enc = encodeURIComponent;

const public_url = Deno.env.get("PUBLIC_URL");
const local_url = "http://127.0.0.1:7878";
const base_url = public_url || local_url;

const redirect_uri = `${base_url}/oauth/callback`;
const scope = "atproto transition:generic";
const client_name = "skypod";
const client_id = public_url
  ? `${public_url}/client-metadata.json`
  : `http://localhost?redirect_uri=${enc(redirect_uri)}&scope=${enc(scope)}`;

const client = new OAuthClient({
  runtimeImplementation: DenoRuntimeImpl,
  handleResolver: new AtprotoHandleResolver(DenoRuntimeImpl),
  stateStore: new DenoKvStore(kv, "oauth", "state"),
  sessionStore: new DenoKvStore(kv, "oauth", "session"),
  responseMode: "query",
  clientMetadata: {
    client_name,
    client_id,
    scope,
    redirect_uris: [redirect_uri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "none",
  },
});

type AppState = {
  session: OakSession;
};

const router = new Router<AppState>();

router.get("/client-metadata.json", (ctx) => {
  console.log("getting metadata");
  ctx.response.type = "application/json";
  ctx.response.body = client.clientMetadata;
});

router.get("/logged-in", async (ctx) => {
  const did = ctx.state.session.get("did") as string;
  if (did == null) {
    return ctx.response.redirect("/");
  }

  const agent = new Agent(await client.restore(did));
  const profile = await agent.com.atproto.repo.getRecord({
    repo: agent.assertDid,
    collection: "app.bsky.actor.profile",
    rkey: "self",
  });

  ctx.response.type = "application/json";
  ctx.response.body = profile;
});

router.get("/oauth/callback", async (ctx) => {
  try {
    const params = ctx.request.url.searchParams;
    console.log("got callback!", { params });
    const { session, state } = await client.callback(params);
    ctx.state.session.set("did", session.did);
    ctx.state.session.set("state", state);
    return ctx.response.redirect("/logged-in");
  } catch (err) {
    console.error({ err }, "oauth callback failed");
    ctx.response.body = "oh no";
    ctx.response.status = 500;
    return;
  }
});

router.post("/oauth/login", async (ctx) => {
  const body = await ctx.request.body.form();
  const handle = body.get("handle");
  if (typeof handle !== "string") {
    return ctx.response.redirect("?error=bad-handle");
  }

  const url = await client.authorize(handle);
  return ctx.response.redirect(url);
});

const app = new Application();

app.use(OakSession.initMiddleware());
app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context, next) => {
  try {
    await context.send({
      root: `${Deno.cwd()}/public`,
      index: "index.html",
    });
  } catch {
    await next();
  }
});

console.log("listening on http://localhost:7878");
app.listen({ port: 7878 });
