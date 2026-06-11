import sys
from pathlib import Path

# Add project root to Python path so we can import scripts/api.py
sys.path.insert(0, str(Path(__file__).parent.parent))

# Vercel looks for a variable named 'app' (ASGI app)
from scripts.api import app  # noqa: F401
