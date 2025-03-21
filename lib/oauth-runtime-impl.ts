import { RuntimeImplementation } from "npm:@atproto/oauth-client";
import {
  AtprotoHandleResolverOptions,
  ResolveHandleOptions,
} from "npm:@atproto-labs/handle-resolver";
import { DenoJoseKey } from "./jose-key.ts";

import * as atjwk from "npm:@atproto/jwk";
import * as jose from "jsr:@panva/jose";

// options for running in deno (dns resolver and fetch as well)

export default {
  fetch,

  async createKey(allowedAlgos: string[]): Promise<atjwk.Key> {
    for (const algo of allowedAlgos) {
      try {
        const { privateKey } = await jose.generateKeyPair(algo, {
          extractable: true,
        });
        const jwk = await jose.exportJWK(privateKey);

        const use = jwk.use || "sig";
        return new DenoJoseKey(
          atjwk.jwkValidator.parse({ ...jwk, use, alg: algo }),
        );
      } catch (ex) {
        console.log(`tried ${algo}, but error: ${ex}, continuing...`);
        // can't use the algo type, keep going
      }
    }

    throw Error(`no acceptable algorithm type in ${allowedAlgos}`);
  },

  getRandomValues(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  },

  async digest(
    bytes: Uint8Array,
    algorithm: { name: string },
  ): Promise<Uint8Array> {
    switch (algorithm.name) {
      case "sha256": {
        const buffer = await crypto.subtle.digest("SHA-256", bytes);
        return new Uint8Array(buffer);
      }

      default:
        throw Error(`Unsupport algorithm: ${algorithm.name}`);
    }
  },

  async resolveTxt(
    domain: string,
    options?: ResolveHandleOptions,
  ): Promise<null | string[]> {
    const res = await Deno.resolveDns(domain, "TXT", {
      signal: options?.signal,
    });
    return res.flat();
  },
} as RuntimeImplementation & AtprotoHandleResolverOptions;
