import { OAuthClient, OAuthClientOptions } from "npm:@atproto/oauth-client";
import { AtprotoHandleResolver } from "npm:@atproto-labs/handle-resolver";

import { DenoKvStore } from "./kv-store.ts";
import DenoRuntimeImpl from "./oauth-runtime-impl.ts";

export { OAuthClient }
export type ClientProps = Omit<OAuthClientOptions, 'runtimeImplementation' | 'handleResolver' | 'stateStore' | 'sessionStore'>

export function buildClient(kv: Deno.Kv, props: ClientProps): OAuthClient {
  return new OAuthClient({
    ...props,
    runtimeImplementation: DenoRuntimeImpl,
    handleResolver: new AtprotoHandleResolver(DenoRuntimeImpl),
    stateStore: new DenoKvStore(kv, "oauth", "state"),
    sessionStore: new DenoKvStore(kv, "oauth", "session"),
  });
}
