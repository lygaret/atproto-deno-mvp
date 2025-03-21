const public_url = Deno.env.get("PUBLIC_URL");
const local_url = "http://127.0.0.1:7878";
export const base_url = public_url || local_url;

const scope = "atproto transition:generic";
const redirect_uri = `${base_url}/oauth/callback`;

const enc = encodeURIComponent;
export const oauth = {
  scope,
  redirect_uri,
  client_id: public_url
    ? `${public_url}/oauth/client-metadata.json`
    : `http://localhost?redirect_uri=${enc(redirect_uri)}&scope=${enc(scope)}`
}
