from backend.database import engine, Base
from backend import models  # noqa: F401 — register models

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created")