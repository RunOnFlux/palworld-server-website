# Content & SEO Plan — palworld.runonflux.com

> Based on Google Search Console (last 3 months, 2026-04-22 → 2026-07-02) + on-page code audit.
> Status at time of writing: homepage draws **2 clicks / 60 impressions / 3.33% CTR / avg pos 13.45**; only the homepage is indexed; the site appears for real commercial Palworld queries but stuck at **pos 48-62**.

## Diagnosis

The technical SEO is **already good** — do not redo it:
- ✅ Strong title, meta description, keywords, OG/Twitter tags, canonical (`index.html`)
- ✅ HTML is **prerendered** — `dist/index.html` ships a real static fallback (~600 words: H1 + H2 sections + plans + a 4-item FAQ), not an empty SPA shell
- ✅ **JSON-LD** present: `Service`, `AggregateOffer`, `Organization`, `WebSite`, and `FAQPage` (emitted from the React `FAQ` component)
- ✅ `robots.txt` allows AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot…) — good GEO
- ✅ 10 FAQ Q&As already live in `src/config/gameConfig.js`

The real problems are **strategic + content**, not technical:
1. **Single page** — `sitemap.xml` lists only `/`. `/support` isn't even in it. There is nothing to rank on informational long-tail.
2. **Query profile is navigational noise, not commercial demand.** The top impressions are `site:runonflux.com` (32 impr, pos 7.59) and `fluxhost` (8 impr, pos 8.75) — brand/navigational. Actual Palworld money terms have only **7 impressions total** and sit at **pos 48-62**:
   - `rent palworld server` — 3 impr, pos 48.67 🔴
   - `palworld servers rent` — 3 impr, pos 62 🔴
   - `palworld server renting` — 1 impr, pos 61 🔴
3. **Zero authority** — brand-new subdomain in one of the most brutal hosting niches: **GPORTAL, Shockbyte, Nitrado**, plus Xgamingserver/BisectHosting. Perfect on-page still ranks 48-62 without backlinks.
4. **Cannibalization risk** with `cloud.runonflux.com/marketplace/games/*`.

Reality check: 60 impressions in 3 months means Google barely surfaces this site for Palworld at all. The near-page-1 positions (avg 13.45) come almost entirely from branded/`site:` queries — the commercial Palworld queries are still on page 5-6.

## A. Keyword universe (from GSC + niche)

Already appearing (real, confirmed — but stuck on page 5+):
- `rent palworld server` — pos 48.67 (3 impr) 🔴 commercial
- `palworld servers rent` — pos 62 (3 impr) 🔴 commercial
- `palworld server renting` — pos 61 (1 impr) 🔴 commercial
- Branded/navigational driving most impressions: `site:runonflux.com` (pos 7.59, 32 impr), `fluxhost` (pos 8.75, 8 impr) — these are not Palworld demand and won't convert players.

Not yet appearing — the commercial head terms to actually target:
- `palworld server hosting` / `palworld dedicated server hosting`
- `palworld dedicated server` / `host palworld server`
- `cheap palworld server hosting` / `best palworld server hosting`
- `32 player palworld server` / `palworld multiplayer hosting`

Not yet appearing — informational long-tail to build authority (lower competition, faster wins):
- `how to make a palworld dedicated server` / `how to host a palworld server`
- `palworld dedicated server requirements` / `palworld server system requirements`
- `how many players can palworld support` (answer: 32)
- `how to join a friend's palworld server` / `palworld dedicated server not showing up / can't connect`
- `best palworld server settings` / `palworld server config` (XP rate, gather, damage, day/night)
- `palworld crossplay dedicated server` / `is palworld cross-platform`
- `how to transfer palworld world to a dedicated server`
- `palworld mods on a dedicated server`

## B. Target architecture (1 page → hub)

```
/                          Homepage (already content-rich; tighten + interlink)
/pricing                   Plans + costs (new)
/setup-guide               "How to make a Palworld dedicated server" (new, HowTo schema)
/server-requirements       System requirements (new)
/guides/                   Guides index (hub)
  /guides/join-server
  /guides/server-settings
  /guides/troubleshooting-connection
  /guides/crossplay
/support                   (exists — ADD to sitemap)
```
**All** URLs go into `sitemap.xml` (today only `/` is there — see `vite.config.js` sitemap plugin).

## C. Homepage — keep the content, sharpen the targeting

Unlike a thin-content site, this homepage already ships ~600 words of prerendered prose + 10 FAQs. Do **not** bloat it — instead:
1. Hero — keep. H1 = "Palworld Server Hosting — Rent a Dedicated Palworld Server" ✓
2. Ensure the visible React-rendered prose matches the depth of the static fallback (feature cards should each carry 1-2 sentences, not just labels).
3. Add a short "How it works" (3-4 steps, ~120 words) if not already rendered — the static fallback has it; make sure React does too.
4. PricingPlans — keep the $3.99/mo / first-month-free intro copy.
5. NEW internal-links block → `/setup-guide`, `/server-requirements`, `/guides/*` (this is the highest-value homepage change — it passes authority to new pages and gives Google a crawl path).
6. Target the head term `palworld server hosting` explicitly in an H2 + one paragraph (currently the copy leans on "rent"/"dedicated server").

## D. New content pieces (build order)

1. **`/setup-guide`** — "How to Make a Palworld Dedicated Server (2026)" ⭐
   - Target: `how to make a palworld dedicated server` / `how to host a palworld server`
   - ~1,500 words. SteamCMD/manual self-host walkthrough vs Flux 30s deploy → natural CTA. Schema: `HowTo` + `FAQPage`.
2. **`/server-requirements`** — "Palworld Dedicated Server Requirements (CPU/RAM/Ports)"
   - Target: `palworld dedicated server requirements`, `how much ram for palworld server`
   - ~800 words + a specs table mapped to the 5GB / 7GB / 10GB plan tiers (ports 8211 UDP, 8212 REST). Schema `FAQPage`.
3. **`/guides/join-server`** — "How to Join a Friend's Palworld Server (incl. Crossplay)"
   - ~700 words. High volume, low competition, great for community links; covers Steam vs Xbox/Game Pass crossplay limits.
4. **`/guides/server-settings`** — "Best Palworld Server Settings (PalWorldSettings.ini)"
   - ~1,000 words + config table (XP rate, gather/damage multipliers, day/night speed, death penalty, PvP, capture rate).
5. **`/pricing`** — dedicated pricing page. Schema `Service`/`AggregateOffer` (avoid `Product` — no review data, matches the existing `index.html` note).

## E. FAQ expansion (10 exist — add informational depth)

The 10 existing Q&As are strong and commercial (cost, player cap, RAM, DDoS, locations, save transfer, settings, backups). Add informational questions that mirror the new long-tail targets and feed the `FAQPage` schema:
- What are the system requirements for a Palworld dedicated server?
- Does Palworld support crossplay on a dedicated server? (Steam ↔ Xbox/Game Pass caveats)
- Why is my Palworld dedicated server not showing up / not connectable? (port 8211 UDP)
- Do I need a dedicated server to play Palworld co-op with friends? (4-player co-op vs 32-player dedicated)
- How do I join my friend's Palworld server?
- Can I run mods on a Palworld dedicated server?
- Which ports does a Palworld dedicated server use? (8211 game / 8212 REST admin)

## F. Schema & internal linking

- Keep `FAQPage` (React-emitted, home only — correct, avoids the duplicate-entity warning noted in `index.html`); feed new Q&A into it.
- Add `HowTo` (setup guide), `BreadcrumbList` (guides), `Service`/`AggregateOffer` (pricing).
- Bidirectional internal links homepage ↔ guides, rich descriptive anchors ("how to make a Palworld dedicated server", not "click here").
- **External links from the Flux ecosystem** (runonflux.com, cloud.runonflux.com, Flux blog/Discord) → this homepage — the single easiest authority lever for a zero-authority subdomain against GPORTAL/Shockbyte/Nitrado.

## G. Execution order & realistic expectation

| Phase | Action | Effort | Impact |
|---|---|---|---|
| Week 1 | All URLs in sitemap; add homepage internal-links block; +7 FAQ | Low | Med-high (quick win) |
| Week 2 | `/setup-guide` (HowTo) + internal links | Med | High |
| Week 3 | `/server-requirements` + `/guides/join-server` | Med | Med |
| Week 4+ | `/pricing`, `/guides/server-settings`, ecosystem backlinks | Ongoing | High (authority) |

Honest expectation: the commercial terms (`rent palworld server` pos 48-62) will not reach page 1 without backlinks — expect page 3-4 in 2-3 months, page 1 in 4-6 months with links. The informational guides (`how to make a palworld dedicated server`, requirements, settings) rank faster and bring the **first real clicks** + the community/reference links that later lift the commercial terms. Palworld is also seasonal — align publishing with content-update spikes.

## H. Measure in GSC (4-6 weeks)

- Indexed pages (1 → 6+)
- Impressions on Palworld informational queries (currently ~0)
- Position of `rent palworld server` / `palworld server hosting` (leaving 48-62)
- Ratio of Palworld-intent impressions vs navigational noise (`site:`/`fluxhost`) — should flip toward Palworld terms
- First non-branded clicks (baseline: 2 clicks total, both effectively from branded/US+Romania traffic)
