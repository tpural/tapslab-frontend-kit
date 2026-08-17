# @tpural/frontend-kit

Client-side hooks and utilities shared by tapslab projects. Ships TypeScript source, no build step.

```jsonc
"@tpural/frontend-kit": "^0.2.0"
```

Published to GitHub Packages; see the
`.npmrc` and access notes in the tapslab-template README.

Add it to `transpilePackages` in `next.config.ts`.

> Published to **GitHub Packages** from a private repo. CI needs no PAT — `GITHUB_TOKEN`
> works once this package grants the consuming repo read access. Locally:
> `gh auth refresh -s read:packages && export NODE_AUTH_TOKEN=$(gh auth token)`.

Small on purpose: in Next 16 most data is read in Server Components and mutated through
Server Actions, so very little goes through a client fetch.

## apiFetch

```ts
const items = await api.get<Page<Item>>("/api/items");
await api.post("/api/items", { title: "New" });
```

Speaks the `@tpural/backend-kit` envelope: returns `data` directly, throws `ApiError`
otherwise, carrying `code`, `status`, and any `fields` for form errors. The envelope type is
type-imported from the backend library so the contract lives in exactly one place — a
duplicated type is the kind of thing that drifts and is then wrong on one side only.

Every request has a 30s default deadline. A fetch with no timeout hangs until the browser
gives up, which can be minutes, with no way for the UI to recover.

## Hooks

| Hook | Notes |
| --- | --- |
| `useDebounce(value, ms)` | Render every keystroke, fetch once typing stops |
| `useMediaQuery(query)` | False on the server and first render — prefer CSS when the answer is purely visual |
| `useLocalStorage(key, initial)` | Syncs across tabs via the `storage` event |
| `useAsync(fn)` | Discards stale results — a slow earlier call cannot overwrite a fast later one |

`useAsync`'s run counter is the reason to use it over a hand-rolled `useState` + `useEffect`:
without it, out-of-order responses overwrite fresh data with stale.

## Formatters

`formatDate` · `formatDateTime` · `formatRelative` · `formatNumber` · `formatBytes` · `truncate`

All accept an explicit locale. **Watch out in SSR:** the server's locale is usually `en-US`
while the browser's is the user's, so formatting a date on the server produces a hydration
mismatch. Either pass an explicit locale or format client-side.
