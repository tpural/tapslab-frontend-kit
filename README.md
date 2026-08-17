# @tapslab/frontend-kit

Client-side hooks and utilities shared by tapslab projects. Ships TypeScript source, no build step.

```jsonc
"@tapslab/frontend-kit": "github:tpural/tapslab-frontend-kit#v0.1.0"
```

Add it to `transpilePackages` in `next.config.ts`.

> This is a **private** repo, so `npm ci` needs a credential. Locally, `gh auth login`
> already handles it. In CI and Docker builds you need a fine-grained PAT with read-only
> Contents access — see the `LIBS_TOKEN` section of the tapslab-template README.

Small on purpose: in Next 16 most data is read in Server Components and mutated through
Server Actions, so very little goes through a client fetch.

## apiFetch

```ts
const items = await api.get<Page<Item>>("/api/items");
await api.post("/api/items", { title: "New" });
```

Speaks the `@tapslab/backend-kit` envelope: returns `data` directly, throws `ApiError`
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
