# GT LMS — 教學協作平台

Padlet 協作牆 · Kahoot 測驗 · 班級管理，部署於 DigitalOcean App Platform。

## 功能

- 登入 / 角色（superadmin、teacher、student）
- 班級建立與加入（6 位代碼）
- **協作牆**（Padlet 風格）— 即時貼文
- **測驗**（Kahoot 風格）— PIN 加入、排行榜

## 技術棧

- 前端：Vite + React + Shadcn UI + Tailwind
- 後端：Express + PostgreSQL（`gt_lms` on `gt-postgresql`）
- 部署：`lms.gtschool.hk` via DO gtcollege

## 本地開發

```bash
npm install
cd server && npm install && cd ..

# 複製 server/.env.example 並填入 DATABASE_URL
npm run dev          # 前端 :5173
cd server && npm run dev   # API :8081
```

## 部署（DigitalOcean）

1. 建立 GitHub repo `ericwong224/gt-lms` 並 push
2. DO App Platform 從 `.do/app.yaml` 部署（或 MCP `apps-create-app-from-spec`）
3. 設定 Secrets：`JWT_SECRET`、`SUPERADMIN_PASSWORD`
4. DNS：`lms.gtschool.hk` → DO App

## 預設 Superadmin

- Email: `info@wwferic.space`
- 密碼：DO Secret `SUPERADMIN_PASSWORD`
