import * as atjwk from "npm:@atproto/jwk";
import * as jose from "jsr:@panva/jose";

import { DenoJoseKey } from "./jose-key.ts";

export type toDpopJwkValue<V extends { dpopKey: atjwk.Key }> =
  & Omit<V, "dpopKey">
  & { dpopJwk: jose.JWK };

export class DenoKvStore<V extends { dpopKey: atjwk.Key }> {
  private store: Deno.Kv;
  private path: string[];

  constructor(store: Deno.Kv, ...path: string[]) {
    this.store = store;
    this.path = path;
  }

  async get(key: string, _: unknown): Promise<undefined | V> {
    const value = await this.store.get([...this.path, key]);
    if (!value) return undefined;

    const { dpopJwk, ...data } = value.value as toDpopJwkValue<V>;
    const validJwk = atjwk.jwkValidator.parse({
      ...dpopJwk,
      use: dpopJwk.use || "sig",
    });
    const dpopKey = new DenoJoseKey(validJwk);

    const result = { ...data, dpopKey } as unknown as V;
    console.log("getting deno:", this.path, key, result);
    return result;
  }

  async set(key: string, { dpopKey, ...data }: V): Promise<void> {
    const dpopJwk = dpopKey.privateJwk;
    if (dpopJwk == null) {
      throw Error("missing private dpop jwk");
    }

    const value: toDpopJwkValue<V> = { dpopJwk, ...data };
    await this.store.set([...this.path, key], value);
  }

  async del(key: string): Promise<void> {
    await this.store.delete([...this.path, key]);
  }

  async clear(): Promise<void> {
    await this.store.delete(this.path);
  }
}
