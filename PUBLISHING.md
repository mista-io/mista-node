# Publishing

1. Bump `version` in `package.json` and `src/version.ts`, and add a CHANGELOG entry.
2. Make sure you are logged in to npm as a member of the `mista` organization (`npm whoami`).
   If the `@mista` scope is not yours, rename the package to `@mista-io/sdk` in `package.json`
   and the README before publishing.
3. Publish (runs typecheck, tests and build first):

   ```bash
   npm publish --access public
   ```

4. Tag the release:

   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
