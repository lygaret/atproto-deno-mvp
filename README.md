# mvp atproto oauth on deno

To use:

```shell
git clone https://github.com/lygaret/atproto-deno-mvp
cd atproto-deno-mvp
vim config.ts # maybe, maybe not
deno run --unstable-kv --allow-all ./main.ts
```

* Go to: http://localhost:7878
* Enter your atproto handle
* Login, and see your profile

## Notes

Most of the code is cribbed from [npm:@atproto/oauth-client-node](https://github.com/bluesky-social/atproto/tree/%40atproto/oauth-client%400.3.11/packages/oauth/oauth-client-node), with updates as 
required to work with [jsr:@panva/jose](https://jsr.io/@panva/jose) rather than the node `crypto` libs. Credit
where it's due, this would have made very little sense without being able to read that
code.
  
### TODO

- [ ] JWT signing keys are generated fresh on every restart
- [ ] Sensitive OAuth data ends up in DenoKV, and shown in the Deno Deploy UI
  
