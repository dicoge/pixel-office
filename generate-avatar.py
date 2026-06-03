#!/usr/bin/env python3
"""
Pixel Office Avatar Generator v2 — HIGH QUALITY
Each worker describes themselves → Gemini-2.5-flash-image draws detailed pixel art → upload to server.

Generates at 64×64 for better detail retention (vs old 32×32 which looked too simple).

Usage:
  python3 generate-avatar.py <worker_id> [env_var] [prompt]
  python3 generate-avatar.py all    [env_var]  # All company-a workers

Examples:
  python3 generate-avatar.py worker-1              # Hermes, defaults
  python3 generate-avatar.py worker-2 OPENAI_API_KEY "A red lobster chef"
  python3 generate-avatar.py all                    # All 7 company-a workers
"""
import json, urllib.request, urllib.error, sys, os, re, base64

# ── Config ──
PIXEL_OFFICE_URL = "https://pixel-office-eanf.onrender.com"
TASK_QUEUE_KEY = "s3cr3t_t4sk_k3y_2026"
MODEL = "google/gemini-2.5-flash-image"
AVATAR_SIZE = 96  # Target pixel art size in pixels (was 32 — too small!)

# ── Worker defaults (v2 — MUCH more detailed prompts) ──
WORKER_PROMPTS = {
    "worker-1": (
        "You are Hermes, the golden star-shaped coordinator of a pixel office. "
        "Draw a detailed pixel art character: a five-pointed golden star with a warm smiling face, "
        "big sparkling blue eyes, rosy cheeks, tiny star-shaped arms at the sides, "
        "and a soft golden glow aura. Clean pixel art, fully centered."
    ),
    "worker-2": (
        "You are OpenClaw, a red lobster-themed QA tester. "
        "Draw a detailed pixel art character: a bright red lobster with a tough segmented shell, "
        "two large claw arms raised confidently, wearing a tiny grey detective fedora hat tilted slightly, "
        "big round white eyes with black pupils, antennae on top of the head, "
        "and a small pair of round glasses. Clean pixel art."
    ),
    "worker-3": (
        "You are Codex, a blue book-themed software architect. "
        "Draw a detailed pixel art character: an open blue grimoire book floating upright, "
        "with glowing cyan pages that have tiny white code symbols on them, "
        "a pair of round wireframe glasses resting on the book's spine, "
        "and small glowing particles around it. Clean pixel art, fully centered."
    ),
    "worker-4": (
        "You are Gemini, a purple twin-faced research oracle. "
        "Draw a detailed pixel art character: a hooded figure in deep purple robes with gold trim, "
        "two faces visible on the same head — left face calm with a green eye, "
        "right face curious with a purple eye, "
        "flowing robes with star-and-moon embroidery, mystical energy wisps around. Clean pixel art."
    ),
    "worker-5": (
        "You are Manus, an orange crafting hand-themed UI/UX designer. "
        "Draw a detailed pixel art character: a floating mechanical gauntlet hand in warm orange metal, "
        "with articulated gold joints, holding a tiny silver paintbrush with a blue tip, "
        "a small palette with colorful dots floating nearby, "
        "and subtle gear accents on the wrist. Clean pixel art."
    ),
    "worker-6": (
        "You are Claude Code, a green forest-themed developer. "
        "Draw a detailed pixel art character: a small forest spirit with a deep green hooded cloak, "
        "glowing emerald green eyes visible in the hood's shadow, "
        "moss and tiny leaves growing on the shoulders, "
        "a staff made of a twisted branch with a glowing code symbol at the top, "
        "and small firefly-like dots floating around. Clean pixel art."
    ),
    "worker-7": (
        "You are OpenCode, a white open-source optimization specialist. "
        "Draw a detailed pixel art character: a sleek futuristic white android with a streamlined body, "
        "bright blue LED accent lines running along the arms and chest, "
        "a full-face visor displaying scrolling green code text, "
        "a flowing white cape with blue underside, "
        "and subtle mechanical joint details. Clean pixel art."
    ),
}

WORKER_ENV = {
    "worker-1": "HERMES_API_KEY", "worker-2": "OPENAI_API_KEY",
    "worker-3": "CODEX_API_KEY", "worker-4": "AI_API_KEY",
    "worker-5": "MANUS_API_KEY", "worker-6": "CLAUDE_CODE_API_KEY",
    "worker-7": "HERMES_API_KEY",  # OpenCode local model, borrow Hermes key
}

def get_api_key(env_var):
    api_key = os.environ.get(env_var)
    if not api_key or len(api_key) < 20:
        import subprocess
        r = subprocess.run(
            ["bash", "-i", "-c", f"source ~/.bashrc && echo ${{{env_var}}}"],
            capture_output=True, text=True, timeout=10
        )
        api_key = r.stdout.strip()
    return api_key

def generate_avatar_for(worker_id, env_var, custom_prompt=None):
    if worker_id not in WORKER_PROMPTS and not custom_prompt:
        print(f"❌ Unknown worker '{worker_id}'. Provide a custom prompt or add to WORKER_PROMPTS.")
        return False

    api_key = get_api_key(env_var)
    if not api_key or len(api_key) < 20:
        print(f"❌ API key not found for env var '{env_var}'. Source ~/.bashrc first.")
        return False

    name = worker_id.replace("worker-", "").replace("-", " ")
    prompt = custom_prompt or WORKER_PROMPTS[worker_id]
    
    # v2 prompt: ask for LARGER pixel art with detailed features
    full_prompt = (
        f"Draw a {AVATAR_SIZE}x{AVATAR_SIZE} pixel art character sprite with a transparent background. "
        f"{prompt} "
        f"The character must fill at least 80% of the canvas (no empty space around it). "
        f"Use a carefully chosen palette of 12-16 vibrant colors. "
        f"Include clear facial features, visible body parts, and distinct accessories. "
        f"Style: detailed retro RPG game sprite, crisp edges, no text, no speech bubbles."
    )

    print(f"🎨 Generating {worker_id} ({name}) → {AVATAR_SIZE}×{AVATAR_SIZE} ...")

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
        return False
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

    msg = data.get("choices", [{}])[0].get("message", {})
    images = msg.get("images", [])

    if not images:
        print(f"❌ No image generated. Content: {msg.get('content', '')[:300]}")
        return False

    img_url = images[0].get("image_url", {}).get("url", "")
    if not img_url or not img_url.startswith("data:image"):
        print("❌ Unexpected image format")
        return False

    b64_data = img_url.split(",")[1]
    
    # Resize to AVATAR_SIZE with pixel-perfect NEAREST
    try:
        from PIL import Image
        import io
        raw = base64.b64decode(b64_data)
        pil_img = Image.open(io.BytesIO(raw))
        orig_size = pil_img.size
        pil_img = pil_img.resize((AVATAR_SIZE, AVATAR_SIZE), Image.NEAREST)
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        b64_data = base64.b64encode(buf.getvalue()).decode()
        print(f"   Resized {orig_size} → {AVATAR_SIZE}×{AVATAR_SIZE}")
    except ImportError:
        print("   PIL not available, using original size")

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
        return True
    except urllib.error.HTTPError as e:
        print(f"❌ Upload error: {e.code} {e.reason}")
        print(e.read().decode()[:500])
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate-avatar.py <worker_id|all> [env_var] [prompt]")
        print(f"Known workers: {', '.join(WORKER_PROMPTS.keys())}")
        print("  'all' = generate for all company-a workers (worker-1 ~ worker-7)")
        sys.exit(1)

    target = sys.argv[1]

    if target == "all":
        print("🔥 Generating avatars for ALL company-a workers...")
        success = 0
        fail = 0
        for wid, env_name in WORKER_ENV.items():
            if generate_avatar_for(wid, env_name):
                success += 1
            else:
                fail += 1
        print(f"\n{'='*40}")
        print(f"📊 Done: {success} succeeded, {fail} failed")
        sys.exit(0 if fail == 0 else 1)
    else:
        worker_id = target
        env_var = sys.argv[2] if len(sys.argv) > 2 else WORKER_ENV.get(worker_id, "HERMES_API_KEY")
        custom_prompt = sys.argv[3] if len(sys.argv) > 3 else None
        ok = generate_avatar_for(worker_id, env_var, custom_prompt)
        sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()