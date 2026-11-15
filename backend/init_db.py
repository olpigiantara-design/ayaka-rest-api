import os
from dotenv import load_dotenv

# Load .env jika ada
load_dotenv()

from backend.database import engine, Base
from backend import models  # Wajib di-import agar SQLAlchemy mengenali tabel

def create_tables():
    print("⏳ Menghubungkan ke Database Neon Tech...")
    try:
        # Membuat semua tabel yang didefinisikan di models.py
        Base.metadata.create_all(bind=engine)
        print("✅ BERHASIL! Semua tabel telah dibuat di database Neon Tech.")
        print("Tabel yang dibuat: users, sessions, api_keys, api_logs, password_reset_tokens, notifications.")
    except Exception as e:
        print(f"❌ GAGAL membuat tabel: {e}")

if __name__ == "__main__":
    create_tables()