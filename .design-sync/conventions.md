## Wrapping and setup

Nothing needs mounting by hand for styling — `styles.css` at the DS root carries every token and utility class. But three components read from React context and will throw or render inert without it: `Sidebar`, `LangSwitcher`, and `ScreenHeader` call `useI18n()` (a small FR/EN dictionary hook), and `Sidebar`/`ScreenHeader` also call router hooks (`NavLink`/`useNavigate`). Wrap any composition that uses them:

```jsx
<I18nProvider>
  <MemoryRouter>
    {/* your composition */}
  </MemoryRouter>
</I18nProvider>
```

`I18nProvider` and `MemoryRouter` are both on `window.LefaxCourse` alongside the components — no extra import needed. Components that don't touch nav/i18n (`Button`, `Card`, `ProgressBar`, `Pill`, `RingProgress`, `Select`, `EmptyState`, `Spinner`, `PhoneFrame`) work standalone.

## Styling idiom: Tailwind utility classes, brand tokens only

This is a Tailwind project — style with utility classes, not inline styles or new CSS. The brand scale is 4 color families, each with 900→50 steps (only the steps below are actually defined — don't invent `-400`/`-200` etc.):

| Family | Steps | Use for |
|---|---|---|
| `ink` | 950, 900, 800, 700, 600, 300, 100, 50 | The dominant brand color — text, primary buttons, dark surfaces (`bg-ink-950` is the sidebar background) |
| `success` | 700, 600, 100, 50 | Positive states, progress |
| `ochre` | 700, 600, 100, 50 | Merit/reward accents (badges, FaxCoins) |
| `danger` | 700, 600, 100, 50 | Errors and destructive actions ONLY — never decorative |

Plus flat semantic colors: `surface` (page background), `card` (card background), `border`, `muted` (secondary text). Two corner radii: `rounded-card` (16px, for `Card` and card-like containers) and `rounded-pill` (999px, for `Pill`/pill-shaped buttons/badges). Two font families: `font-serif` (Newsreader — headings/titles only) and the default sans (Public Sans, applied automatically to `body`, no class needed).

## Where the truth lives

- `styles.css` (root) — `@import`s the Google Fonts stylesheet (Newsreader + Public Sans load at runtime, not shipped as local font files) and the full compiled Tailwind stylesheet. Read it before styling anything outside the documented scale above.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage doc with real prop signatures.
- `components/<group>/<Name>/<Name>.d.ts` — the props contract to code against.

## Example composition

```jsx
<I18nProvider>
  <MemoryRouter>
    <PhoneFrame>
      <ScreenHeader title="Biologie — Chapitre 3" />
      <div className="p-5 flex flex-col gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted mb-1">Ma progression</div>
          <ProgressBar pct={62} color="success" />
        </Card>
        <Button variant="primary">Continuer</Button>
      </div>
    </PhoneFrame>
  </MemoryRouter>
</I18nProvider>
```
