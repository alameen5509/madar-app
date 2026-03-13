# مدار — Madar ERP

> نظام إدارة الحياة الذكي | Intelligent Life Management System

A full-stack monorepo combining an Islamic-inspired Arabic dashboard with a clean-architecture .NET backend.

---

## Structure

```
madar-app/
├── backend/          # ASP.NET Core 10 API (Clean Architecture)
│   ├── src/
│   │   ├── Madar.API/            # Controllers, Program.cs
│   │   ├── Madar.Application/    # CQRS, MediatR, interfaces
│   │   ├── Madar.Domain/         # Entities, enums, domain logic
│   │   └── Madar.Infrastructure/ # EF Core (MySQL/TiDB), Identity, AI
│   ├── Madar.sln
│   └── Dockerfile
│
└── frontend/         # Next.js 15 — Arabic RTL Dashboard
    ├── src/
    │   ├── app/                  # App Router (layout, page, globals.css)
    │   └── components/           # IslamicPattern SVG components
    ├── package.json
    └── next.config.ts
```

---

## Backend

| Tech | Detail |
|------|--------|
| Runtime | .NET 10 / ASP.NET Core |
| ORM | EF Core + Pomelo MySQL (TiDB Cloud) |
| Auth | ASP.NET Identity + JWT |
| AI | Anthropic Claude SDK |
| Architecture | Clean Architecture (Domain / Application / Infrastructure / API) |

```bash
cd backend
dotnet run --project src/Madar.API
# API: http://localhost:5000
# Swagger: http://localhost:5000/swagger
```

---

## Frontend

| Tech | Detail |
|------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Fonts | Cairo + Amiri (Google Fonts) |
| Direction | RTL Arabic |
| Design | Islamic geometric art meets modern SaaS |

```bash
cd frontend
npm install
npm run dev
# Dashboard: http://localhost:3000
```

---

## Brand Colors

| Name | Hex |
|------|-----|
| Primary (Slate Blue) | `#5E5495` |
| Sidebar (Deep Navy) | `#2A2542` |
| Gold Accent | `#C9A84C` |
| Background (Warm Parchment) | `#F8F6F0` |

---

*بسم الله الرحمن الرحيم*
