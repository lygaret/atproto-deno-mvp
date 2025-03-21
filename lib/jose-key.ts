import * as atjwk from "npm:@atproto/jwk";
import * as jose from "jsr:@panva/jose";

export class DenoJoseKey<J extends atjwk.Jwk = atjwk.Jwk> extends atjwk.Key<J> {
  protected async getKeyObj(alg: string) {
    if (!this.algorithms.includes(alg)) {
      throw Error(`Key cannot be used with algorithm "${alg}"`);
    }

    return await jose.importJWK(this.jwk as jose.JWK, alg);
  }

  override get algorithms(): string[] {
    return this.alg ? [this.alg] : [];
  }

  override async createJwt(
    header: atjwk.JwtHeader,
    payload: atjwk.JwtPayload,
  ): Promise<atjwk.SignedJwt> {
    const { kid } = header;
    if (kid && kid !== this.kid) {
      throw Error(`kid ${this.kid} cannot sign for ${kid}`);
    }

    const { alg } = header;

    const key = await this.getKeyObj(alg);
    const signer = new jose.SignJWT(payload).setProtectedHeader({
      ...header,
      alg,
      kid: this.kid,
    });

    return await signer.sign(key) as atjwk.SignedJwt;
  }

  override async verifyJwt<C extends string = never>(
    token: atjwk.SignedJwt,
    options?: atjwk.VerifyOptions<C>,
  ): Promise<atjwk.VerifyResult<C>> {
    const { payload, protectedHeader } = await jose.jwtVerify(
      token,
      async ({ alg }) => await this.getKeyObj(alg),
      { ...options, algorithms: this.algorithms } as jose.JWTVerifyOptions,
    );

    const headerParsed = atjwk.jwtHeaderSchema.safeParse(protectedHeader);
    if (!headerParsed.success) {
      throw Error(`invalid jwt header, ${protectedHeader}`);
    }

    const payloadParsed = atjwk.jwtPayloadSchema.safeParse(payload);
    if (!payloadParsed.success) {
      throw Error(`invalid jwt payload`);
    }

    return {
      protectedHeader: headerParsed.data,
      payload: payloadParsed.data as atjwk.RequiredKey<atjwk.JwtPayload, C>,
    };
  }
}
