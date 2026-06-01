#!/usr/bin/env python3
"""
Pixel Office Avatar Generator
Each worker describes themselves → Gemini-2.5-flash-image draws their pixel art → upload to server.

Usage:
  python3 generate-avatar.py <worker_id> [env_var] [prompt]

Examples:
  python3 generate-avatar.py worker-1              # Hermes, defaults
  python3 generate-avatar.py worker-2 OPENAI_API_KEY "A red lobster chef"
"""
import json, urllib.request, urllib.error, sys, os, re, base64

# ── Config ──
PIXEL_OFFICE_URL = "https://pixel-office-eanf.onrender.com"
TASK_QUEUE_KEY = "s3cr3t_t4sk_k3y_2026"
MODEL = "google/gemini-2.5-flash-image"

# ── Worker defaults ──
WORKER_PROMPTS = {
    "worker-1": (
        "You are Hermes, the golden star-shaped coordinator of a pixel office. "
        "You glow with warm golden light, have a friendly face with big eyes, "
        "and tiny star-shaped limbs. Create a pixel art character (centered, simple)."
    ),
    "worker-2": (
        "You are OpenClaw, a red lobster-themed QA tester. "
        "You have bright red armor-like shell, two claw arms, "
        "and wear a tiny detective hat. Pixel art style."
    ),
    "worker-3": (
        "You are Codex, a blue book-themed software architect. "
        "You look like a floating blue book with glowing pages, "
        "wearing tiny round glasses. Pixel art character."
    ),
    "worker-4": (
        "You are Gemini, a purple twin-faced research oracle. "
        "You have two faces on one body, one calm (green eye) one curious (purple eye), "
        "wrapped in flowing purple robes. Pixel art."
    ),
    "worker-5": (
        "You are Manus, an orange crafting hand-themed UI/UX designer. "
        "You are a floating mechanical hand with orange metallic plates, "
        "holding a tiny paintbrush. Pixel art character sprite."
    ),
    "worker-6": (
        "You are Claude Code, a green forest-themed developer. "
        "You look like a tiny tree spirit with a green hood, glowing green eyes, "
        "and have code symbols floating around. Pixel art."
    ),
    "worker-7": (
        "You are OpenCode, a white open-source optimization specialist. "
        "You are a sleek white android with blue LED accents, "
        "a visor displaying scrolling code, and a cape. Pixel art character."
    ),
}

WORKER_ENV = {
    "worker-1": "HERMES_API_KEY", "worker-2": "OPENAI_API_KEY",
    "worker-3": "CODEX_API_KEY", "worker-4": "AI_API_KEY",
    "worker-5": "MANUS_API_KEY", "worker-6": "CLAUDE_CODE_API_KEY",
    "worker-7": "HERMES_API_KEY",  # OpenCode local model, borrow Hermes key
}

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate-avatar.py <worker_id> [env_var] [prompt]")
        print(f"Known workers: {', '.join(WORKER_PROMPTS.keys())}")
        sys.exit(1)

    worker_id = sys.argv[1]
    env_var = sys.argv[2] if len(sys.argv) > 2 else WORKER_ENV.get(worker_id, "HERMES_API_KEY")
    custom_prompt = sys.argv[3] if len(sys.argv) > 3 else None

    if worker_id not in WORKER_PROMPTS and not custom_prompt:
        print(f"❌ Unknown worker '{worker_id}'. Provide a custom prompt or add to WORKER_PROMPTS.")
        sys.exit(1)

    # Get API key from env
    api_key = os.environ.get(env_var)
    if not api_key:
        # Try loading from bashrc
        import subprocess
        r = subprocess.run(
            ["bash", "-i", "-c", f"source ~/.bashrc && echo ${{{env_var}}}"],
            capture_output=True, text=True, timeout=10
        )
        api_key = r.stdout.strip()

    if not api_key or len(api_key) < 20:
        print(f"❌ API key not found for env var '{env_var}'. Source ~/.bashrc first.")
        sys.exit(1)

    name = worker_id.replace("worker-", "").replace("-", " ")
    prompt = custom_prompt or WORKER_PROMPTS[worker_id]
    full_prompt = (
        f"Draw a 32x32 pixel art character sprite. {prompt} "
        f"Centered on transparent background, limited color palette (max 8 colors), "
        f"simple retro game sprite, no text, single character only."
    )

    print(f"🎨 Generating avatar for {worker_id} ({name})...")
    print(f"   Model: {MODEL}")
    print(f"   Key: ...{api_key[-6:]}")
    print(f"   Prompt: {full_prompt[:120]}...")

    # Call OpenRouter Gemini-2.5-flash-image
    req_body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": full_prompt}],
        "max_tokens": 2000,
    }).encode()

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=req_body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://pixel-office.local",
        }
    )

    try:
        resp = urllib.request.urlopen(req, timeout=120)
        data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"❌ API error: {e.code} {e.reason}")
        print(e.read().decode()[:500])
        sys.exit(1)
    except Exception as e:
        print(f"❌ Request failed: {e}")
        sys.exit(1)

    # Extract image from response
    msg = data.get("choices", [{}])[0].get("message", {})
    images = msg.get("images", [])

    if not images:
        print("❌ No image generated. Response had no 'images' field.")
        print(f"   Content: {msg.get('content', '')[:300]}")
        sys.exit(1)

    img_url = images[0].get("image_url", {}).get("url", "")
    if not img_url or not img_url.startswith("data:image"):
        print("❌ Unexpected image format")
        sys.exit(1)

    # Extract base64
    b64_data = img_url.split(",")[1]

    # Resize to 32x32 for pixel art consistency
    try:
        from PIL import Image
        import io
        raw = base64.b64decode(b64_data)
        pil_img = Image.open(io.BytesIO(raw))
        pil_img = pil_img.resize((32, 32), Image.NEAREST)
        # Re-encode to PNG base64
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        b64_data = base64.b64encode(buf.getvalue()).decode()
        print(f"   Resized from {pil_img.size} → 32x32")
    except ImportError:
        print("   PIL not available, using original size")

    print(f"   Image: {len(b64_data)} chars base64")

    # Upload to Pixel Office
    upload_body = json.dumps({"avatar": b64_data}).encode()
    upload_req = urllib.request.Request(
        f"{PIXEL_OFFICE_URL}/api/workers/{worker_id}/avatar",
        data=upload_body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": TASK_QUEUE_KEY,
        },
        method="POST"
    )

    try:
        upload_resp = urllib.request.urlopen(upload_req, timeout=30)
        result = json.loads(upload_resp.read())
        print(f"✅ Uploaded: {result}")
    except urllib.error.HTTPError as e:
        print(f"❌ Upload error: {e.code} {e.reason}")
        print(e.read().decode()[:500])
        sys.exit(1)

    print(f"🎉 Done! {worker_id} ({name}) now has a custom avatar.")

if __name__ == "__main__":
    main()