# SynthiaDash ⚡

Mission Control dashboard for Synthia AI assistant.

## Features

### For Feng (Admin)
- Full system status (online/offline, model, uptime, cost)
- All repo overview with deploy status
- Session monitor (active conversations)
- Cron job management
- Token usage & cost tracking
- Direct chat with Synthia

### For Team Members (Scoped Access)
- View their assigned repo(s) only
- Trigger builds & deploys
- View build logs & deploy history
- Chat with Synthia (scoped to their repo)
- Basic status indicators

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** .NET 8 Web API (proxy to Clawdbot gateway + GitHub API)
- **Auth:** JWT (shared via Funtime Identity or standalone)
- **Deploy:** IIS via GitHub Actions (self-hosted runner)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Dashboard   │────▶│  .NET API    │────▶│ Clawdbot Gateway│
│  (React)     │     │  (Backend)   │     │  (port 18789)   │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  GitHub API  │
                    │  (Actions,   │
                    │   Repos)     │
                    └──────────────┘
```

## Getting Started

```bash
# Backend
cd backend/SynthiaDash.Api
dotnet restore
dotnet run

# Frontend
cd frontend
npm install
npm run dev
```
