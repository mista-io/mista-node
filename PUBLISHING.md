# Publishing

1. Bump `version` in `package.json` and `src/version.ts`, and add a CHANGELOG entry.
2. Log in to npm (`npm login`, check with `npm whoami`) as an owner of the `mista-sdk` package.
   The first publish creates the package under your account.
3. Publish (runs typecheck, tests and build first):

   ```bash
   npm publish --access public
   ```

4. Tag the release:

   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
