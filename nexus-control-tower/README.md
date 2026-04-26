# NEXUS Control Tower v4.0

Dashboard quản lý toàn bộ NEXUS AI Product Studio ecosystem.

## Stack
- **Frontend**: Next.js 14 + React
- **Database**: Supabase (REST API)
- **AI**: Claude API via server-side proxy (no CORS issue)
- **Deploy**: Vercel

## Deploy lên Vercel

### 1. Push lên GitHub
```bash
git init
git add .
git commit -m "NEXUS Control Tower v4.0"
git remote add origin https://github.com/ThanhEngineer/nexus-control-tower.git
git push -u origin main
```

### 2. Import vào Vercel
- Vào vercel.com → New Project → Import từ GitHub
- Chọn repo `nexus-control-tower`

### 3. Set Environment Variables trong Vercel
```
NEXT_PUBLIC_SUPABASE_URL    = https://hrvhzpajoczgwgtwycov.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_A6JEwilzYr037XpjOP5q1w_Ye6E5bZ0
ANTHROPIC_API_KEY           = sk-ant-... (Claude API key của bạn)
```

### 4. Deploy → Done ✓

## Local Dev
```bash
# Copy env
cp .env.example .env.local
# Điền keys vào .env.local

npm install
npm run dev
# → http://localhost:3000
```

## Features
- Dashboard với stats + recent logs + open alerts
- Projects management
- Daily Logs (CRUD, filter by project/category)  
- KPI Snapshots (revenue VND/USD, users, KDP)
- Alerts (severity, resolve)
- T.Nexus AI — 5 analysis modes + custom prompt
