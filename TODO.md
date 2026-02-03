# ⚡ SynthiaDash (synthia.bot) — Analysis & TODO
**Last Updated:** 2026-02-03 | **Maintainer:** Synthia

## Current State
- **Repo:** 3E-Tech-Corp/SynthiaDash
- **Live:** synthia.bot
- **Stack:** .NET 8 + React/Vite/TS + Tailwind + Dapper + SQL Server + Deepgram
- **Status:** Active — platform hub for all projects

## ✅ Recently Completed (Feb 3)
- [x] Rebrand: SynthiaDash → Synthia.bot (navbar, sidebar, login, footer, favicon)
- [x] Logo: Double-S yin-yang taichi symbol, purple-to-blue gradient (Feng designed via GPT-4o)
- [x] AnimatedLogo component — 4 random animations (pulse, wiggle, bounce-spin, glitch)
- [x] Featured Projects carousel — DB-backed, admin management, auto-scrolling
- [x] Voice Chat — Deepgram nova-2 STT + Aura TTS, full hands-free loop
- [x] Asset management system — canonical pattern for ALL projects
- [x] Project Members feature — multi-user project access with roles
- [x] Link existing repos (not just template-created)

## 🟡 Medium
- [ ] **Project health monitoring** — Periodic checks if deployed sites are responding (HTTP ping)
- [ ] **Deployment dashboard** — Trigger GitHub Actions deploys from SynthiaDash UI
- [ ] **Usage analytics** — Track API calls, page views, errors per project
- [ ] **Project templates** — Pre-configured .NET + React templates for one-click project creation
- [ ] **Chat history** — Persist Synthia chat conversations for reference

## 🟢 Low
- [ ] **Multi-tenant theming** — Each project gets its own color scheme in the dashboard
- [ ] **Notification center** — Aggregate deploy status, errors, and alerts from all projects
- [ ] **Backup management** — Trigger and manage SQL backups from the dashboard
- [ ] **SSL certificate dashboard** — Monitor cert expiration for all *.synthia.bot sites

## Technical Notes
- **Naming convention:** `Demo_{Id}_{Title}` for IIS site name, app pool, AND database name
- **Controller routes:** `[Route("[controller]")]` — IIS virtual app at `/api` provides prefix
- **SSL:** `CN=synthia.bot` cert in WebHosting store (win-acme auto-renew), SNI flag
- **Deepgram API key:** Stored in `appsettings.Production.json` as `Deepgram:ApiKey`
- **Default admin:** admin@synthia.bot / Synth!@
- **Asset pattern:** `GET /asset/{id}` is canonical URL — files named `{siteKey}/{YYYY-MM}/{assetId}.{ext}`
