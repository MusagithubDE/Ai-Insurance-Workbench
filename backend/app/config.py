"""Runtime configuration, loaded from environment variables (optionally via
a .env file -- see .env.example). Swapping the model adapter or pointing at
a different Ollama tag is a config change here, never a code change at the
call sites in app/model_tasks.py."""
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

MODEL_ADAPTER = os.environ.get("MODEL_ADAPTER", "ollama")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:4b-instruct-2507-q4_K_M")
MODEL_TIMEOUT_SECONDS = float(os.environ.get("MODEL_TIMEOUT_SECONDS", "60"))
