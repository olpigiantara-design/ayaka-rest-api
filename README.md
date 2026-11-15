# AYAKA REST API

> One API. Unlimited Possibilities. — Powered by Ayaka Sync

A production-ready REST API platform with personal API key management, developer dashboard, analytics, and secure authentication. Built with FastAPI + Neon PostgreSQL, deployed on Vercel.

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Pydantic
- **Database**: Neon Tech PostgreSQL (serverless)
- **Frontend**: HTML5, CSS3 (Neo Brutalism), Vanilla JS
- **Security**: Argon2 password hashing, HTTP-only sessions, CSRF, SHA-256 API key hashing
- **Deployment**: Vercel (serverless functions + static)

## Setup

### 1. Neon Database
1. Go to https://console.neon.tech → Create project
2. Copy the **pooled** connection string (`...-pooler...neon.tech/...?sslmode=require`)
3. Save as `DATABASE_URL`

### 2. Local Development
```bash
git clone <your-repo>
cd ayaka-rest-api
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill DATABASE_URL etc.
python -c "from backend.database import engine, Base; from backend import models; Base.metadata.create_all(bind=engine)"
uvicorn backend.main:app --reload