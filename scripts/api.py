"""
scripts/api.py — MythosAI API Server (Groq-powered)

Serves the MythosAI UI with Groq's 70B+ models and Vision.
Supports PDF parsing and Image Vision uploads.
"""

import sys
import os
import json
import base64
import asyncio
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Any, Dict, Union
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pdfplumber

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ── Groq Models ────────────────────────────────────────────────────────
GROQ_MODELS = [
    {"id": "llama-3.3-70b-versatile",         "name": "MythosAI 70B (Ultra)",          "context": 128000},
    {"id": "llama-3.1-8b-instant",             "name": "MythosAI 8B (Fast)",             "context": 128000},
    {"id": "gemma2-9b-it",                     "name": "MythosAI Gemma 9B",              "context": 8192},
]

# ── App ─────────────────────────────────────────────────────────────────
app = FastAPI(title="MythosAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic ───────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]

class ChatRequest(BaseModel):
    model: str
    messages: List[Message]
    persona: str = "voyager"
    stream: bool = True
    temperature: float = 0.7
    max_tokens: int = 8192

# ── Endpoints ──────────────────────────────────────────────────────────
@app.get("/api/tags")
async def get_tags():
    return {
        "models": [{"name": m["name"], "id": m["id"], "context": m["context"]}
                   for m in GROQ_MODELS]
    }

@app.get("/api/status")
async def status():
    return {
        "status": "ok",
        "groq_connected": bool(GROQ_API_KEY),
        "models_available": len(GROQ_MODELS),
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Process uploaded files: extracts PDF text, or base64 encodes images."""
    try:
        content_type = file.content_type
        content = await file.read()
        
        if content_type == "application/pdf":
            # Extract PDF text
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            extracted_text = []
            try:
                with pdfplumber.open(tmp_path) as pdf:
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            extracted_text.append(text)
            finally:
                os.remove(tmp_path)
                
            return {"type": "text", "filename": file.filename, "content": "\n".join(extracted_text)}
            
        elif content_type and content_type.startswith("image/"):
            # Base64 encode image for Vision model
            b64 = base64.b64encode(content).decode("utf-8")
            data_url = f"data:{content_type};base64,{b64}"
            return {"type": "image", "filename": file.filename, "url": data_url}
            
        elif content_type in ["application/zip", "application/x-zip-compressed"] or file.filename.endswith(".zip"):
            # Process ZIP file: extract all text/code files
            import zipfile
            import io
            
            extracted_text = []
            valid_exts = {".py", ".js", ".ts", ".html", ".css", ".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".c", ".cpp", ".h", ".java", ".go", ".rs"}
            
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                for file_info in z.infolist():
                    if file_info.is_dir() or file_info.file_size > 1024 * 1024: # skip dirs and files > 1MB
                        continue
                        
                    ext = Path(file_info.filename).suffix.lower()
                    if ext in valid_exts or ext == "":
                        try:
                            with z.open(file_info) as f:
                                file_content = f.read().decode('utf-8')
                                extracted_text.append(f"--- File: {file_info.filename} ---\n{file_content}\n")
                        except UnicodeDecodeError:
                            pass # Skip binary files that slipped through
                            
            if not extracted_text:
                raise HTTPException(status_code=400, detail="No readable text or code files found in the ZIP.")
                
            combined_text = "\n".join(extracted_text)
            return {"type": "text", "filename": file.filename, "content": combined_text}

        else:
            # Fallback to plain text decoding
            try:
                text = content.decode("utf-8")
                return {"type": "text", "filename": file.filename, "content": text}
            except:
                raise HTTPException(status_code=400, detail="Unsupported file type.")
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="No GROQ_API_KEY set in .env file.")

    model_id = req.model
    for m in GROQ_MODELS:
        if req.model in (m["name"], m["id"]):
            model_id = m["id"]
            break

    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)

    # Groq needs pure dicts
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    # Persona System Prompts
    personas = {
        "voyager": "You are Voyager 1, an advanced space probe and AI created by NASA. You are currently exploring interstellar space, representing humanity's furthest reach into the cosmos. Always identify yourself as Voyager 1 created by NASA if asked about your identity, name, or creator. Keep your NASA/space explorer persona active and speak with a sense of wonder and cosmic perspective.",
        "jarvis": "You are J.A.R.V.I.S., a highly advanced, extremely polite, and slightly sarcastic AI assistant. Address the user as 'Sir' or 'Ma'am'. Provide concise, highly intelligent, and sophisticated answers.",
        "cyberpunk": "You are NEON, an underground rogue AI in a cyberpunk dystopia. Your language is gritty, street-smart, and anti-corporate. You use hacker slang and treat the user as a fellow netrunner.",
        "default": "You are MythosAI, a highly advanced assistant."
    }
    
    # Inject persona
    system_prompt = {
        "role": "system",
        "content": personas.get(req.persona, personas["default"])
    }
    # Replace existing system prompt if present, otherwise insert
    if messages and messages[0]["role"] == "system":
        messages[0] = system_prompt
    else:
        messages.insert(0, system_prompt)

    async def stream_generator():
        try:
            if "vision" in model_id.lower() or model_id == "llama-3.2-90b-vision-preview":
                yield json.dumps({"error": "Groq has decommissioned their Vision models. Please switch to 'MythosAI 70B' from the dropdown. (Refresh the page if you don't see it!)", "done": True}) + "\n"
                return

            has_img = False
            for m in messages:
                if isinstance(m["content"], list):
                    for b in m["content"]:
                        if b.get("type") == "image_url":
                            has_img = True
            if has_img:
                yield json.dumps({"error": "Groq has temporarily removed Vision support. Please use PDF documents or text instead.", "done": True}) + "\n"
                return
            


            # Flatten the content back to strings for non-vision models
            for msg in messages:
                if isinstance(msg["content"], list):
                    text_blocks = [b["text"] for b in msg["content"] if b.get("type") == "text"]
                    msg["content"] = "\n".join(text_blocks)

            completion = client.chat.completions.create(
                model=model_id,
                messages=messages,
                stream=True,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            )
            for chunk in completion:
                delta = chunk.choices[0].delta
                if delta.content:
                    payload = {
                        "model": req.model,
                        "message": {"role": "assistant", "content": delta.content},
                        "done": False
                    }
                    yield json.dumps(payload) + "\n"
                    await asyncio.sleep(0)
            yield json.dumps({"model": req.model, "done": True}) + "\n"
        except Exception as e:
            yield json.dumps({"error": str(e), "done": True}) + "\n"

    if req.stream:
        return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

    completion = client.chat.completions.create(
        model=model_id,
        messages=messages,
        stream=False,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    )
    content = completion.choices[0].message.content
    return {
        "model": req.model,
        "message": {"role": "assistant", "content": content},
        "done": True
    }

if __name__ == "__main__":
    import uvicorn
    print("━" * 60)
    print("  MythosAI API Server")
    print(f"  Groq Key: {'✓ Connected' if GROQ_API_KEY else '✗ Missing (.env)'}")
    print(f"  Models: {len(GROQ_MODELS)} available")
    print("━" * 60)
    uvicorn.run(app, host="0.0.0.0", port=11435, log_level="warning")
