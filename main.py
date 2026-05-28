import os
import json
import base64

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# ── Groq client ─────────────────────────────────────────────────────────────
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-4-scout-17b-16e-instruct"

# ── Prompt ───────────────────────────────────────────────────────────────────
NUTRISI_PROMPT = """Kamu adalah ahli gizi profesional. Analisis gambar makanan ini.
Kembalikan HANYA objek JSON valid, tanpa markdown, tanpa backtick, tanpa teks lain.
Format persis seperti ini:
{
  "nama_makanan": "string",
  "porsi_estimasi": "string",
  "kalori": number,
  "nutrisi": {
    "karbohidrat_g": number,
    "protein_g": number,
    "lemak_g": number,
    "serat_g": number,
    "gula_g": number
  },
  "skor_kesehatan": number,
  "catatan": "string",
  "alergen_potensial": ["string"]
}
Catatan: skor_kesehatan antara 1-10. Jika bukan makanan: {"error": "Gambar bukan makanan"}"""

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="NutriCheck AI", version="3.0.0")


@app.post("/api/analisis")
async def analisis_makanan(file: UploadFile = File(...)):
    # Validasi
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar.")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Ukuran gambar maksimal 10 MB.")

    # Encode base64
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    media_type = file.content_type

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_b64}"
                            },
                        },
                        {
                            "type": "text",
                            "text": NUTRISI_PROMPT,
                        },
                    ],
                }
            ],
            max_tokens=1024,
            temperature=0.1,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

    raw_text = response.choices[0].message.content.strip()

    # Bersihkan markdown fence jika ada
    if "```" in raw_text:
        parts = raw_text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                raw_text = part
                break

    # Cari JSON object dalam teks (fallback)
    if not raw_text.startswith("{"):
        start = raw_text.find("{")
        end = raw_text.rfind("}") + 1
        if start != -1 and end > start:
            raw_text = raw_text[start:end]

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422,
            detail={"message": "Model tidak mengembalikan JSON valid.", "raw": raw_text},
        )

    if "error" in result:
        return JSONResponse(status_code=400, content=result)

    return JSONResponse(content=result)


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")