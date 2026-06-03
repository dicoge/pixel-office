#!/usr/bin/env python3
"""
Pixel Office Custom Animated Spritesheet Generator v1
Generates 6-frame idle animation spritesheets using Gemini-2.5-flash-image.

Spritesheet format: 192x32 (6 frames of 32x32 side by side)
Frontend: load as Phaser spritesheet with frameWidth:32, frameHeight:32
"""
import json, urllib.request, urllib.error, sys, os, base64
from PIL import Image
import io

PIXEL_OFFICE_URL = "https://pixel-office-eanf.onrender.com"
MODEL = "google/gemini-2.5-flash-image"

# Worker spritesheet configs
SPRITESHEETS = {
    "worker-1": {
        "key": "custom_hermes",
        "name": "Hermes",
        "frames": 6,
        "frame_size": 64,
        "prompt": (
            "Create a detailed pixel art character as a spritesheet. "
            "The character: Hermes, a golden 5-pointed star character with a warm smiling face, "
            "big bright blue eyes, rosy cheeks, two star-shaped arms at the sides, "
            "and a soft golden glow aura around it. "
            "THE CHARACTER MUST FILL THE ENTIRE FRAME - draw it large. "
            "Each frame should be 64x64 pixels, 6 frames total = 384x64 pixels. "
            "6 frames of idle animation: gentle up-down bounce, eyes occasionally blink, glow pulses. "
            "Style: detailed retro RPG sprite, transparent background, crisp pixel edges, no text. "
            "Use 12-16 vibrant colors for a rich look."
        ),
        "scale": 3.2
    },
    "worker-2": {
        "key": "custom_openclaw",
        "name": "OpenClaw",
        "frames": 6,
        "prompt": (
            "Create a 32x32 pixel art character spritesheet showing 6 frames of idle animation. "
            "The character: a bright red lobster named OpenClaw with a hard segmented shell, "
            "two large claws that open and close slowly, wearing a tiny grey detective fedora hat, "
            "big round white eyes, antennae that twitch, small round glasses. "
            "Animation: claws gently open and close, antennae wiggle, body sways slightly. "
            "Layout: EXACTLY 6 frames horizontally. Total 192x32 pixels. "
            "Pixel art, transparent background, no text."
        )
    },
    "worker-3": {
        "key": "custom_codex",
        "name": "Codex",
        "frames": 6,
        "prompt": (
            "Create a 32x32 pixel art character spritesheet showing 6 frames of idle animation. "
            "The character: a floating open blue grimoire book named Codex, "
            "glowing cyan pages with tiny white code symbols, wireframe glasses on the book's spine, "
            "small glowing particles floating around it. "
            "Animation: pages flutter gently, the book bobs up and down, glow pulses. "
            "Layout: 6 frames horizontally. 192x32 pixels. "
            "Pixel art, transparent background, no text."
        )
    },
    "worker-4": {
        "key": "custom_gemini",
        "name": "Gemini",
        "frames": 6,
        "prompt": (
            "Create a 32x32 pixel art character spritesheet showing 6 frames of idle animation. "
            "The character: a hooded figure in deep purple robes with gold trim named Gemini, "
            "two faces on one head — left calm (green eye), right curious (purple eye), "
            "flowing robes with star/moon embroidery, mystical energy wisps. "
            "Animation: the two faces alternate looking around, robes sway, energy pulses. "
            "Layout: 6 frames horizontally. 192x32 pixels. "
            "Pixel art, transparent background, no text."
        )
    },
    "worker-5": {
        "key": "custom_manus",
        "name": "Manus",
        "frames": 6,
        "prompt": (
            "Create a 32x32 pixel art character spritesheet showing 6 frames of idle animation. "
            "The character: a floating mechanical gauntlet hand in warm orange metal named Manus, "
            "articulated gold joints, holding a tiny silver paintbrush with a blue tip, "
            "a small colorful palette floating nearby, subtle gear accents. "
            "Animation: the hand rotates slightly, fingers wiggle, paintbrush dabs, palette floats. "
            "Layout: 6 frames horizontally. 192x32 pixels. "
            "Pixel art, transparent background, no text."
        )
    },
    "worker-6": {
        "key": "custom_claude",
        "name": "Claude Code",
        "frames": 6,
        "prompt": (
            "Create a 32x32 pixel art character spritesheet showing 6 frames of idle animation. "
            "The character: a small forest spirit in a deep green hooded cloak named Claude Code, "
            "glowing emerald eyes, moss/leaves on shoulders, a twisted branch staff "
            "with a glowing code symbol at the top, firefly dots floating around. "
            "Animation: the staff glow pulses, fireflies orbit, cloak sways, head tilts. "
            "Layout: 6 frames horizontally. 192x32 pixels. "
            "Pixel art, transparent background, no text."
        )
    },
    "worker-7": {
        "key": "custom_opencode",
        "name": "OpenCode",
        "frames": 6,
        "prompt": (
            "Create a 32x32 pixel art character spritesheet showing 6 frames of idle animation. "
            "The character: a sleek white android named OpenCode, blue LED accent lines on arms/chest, "
            "full-face visor displaying scrolling green code, flowing white cape with blue underside, "
            "mechanical joint details. "
            "Animation: visor code scrolls, LEDs pulse, cape flows gently, head scans left-right. "
            "Layout: 6 frames horizontally. 192x32 pixels. "
            "Pixel art, transparent background, no text."
        )
    }
}

def get_api_key(env_var="HERMES_API_KEY"):
    api_key = os.environ.get(env_var)
    if not api_key or len(api_key) < 20:
        import subprocess
        r = subprocess.run(
            ["bash", "-i", "-c", f"source ~/.bashrc && echo ${{{env_var}}}"],
            capture_output=True, text=True, timeout=10
        )
        api_key = r.stdout.strip()
    return api_key

def generate_spritesheet(worker_id, api_key):
    if worker_id not in SPRITESHEETS:
        print(f"❌ Unknown worker '{worker_id}'")
        return None

    cfg = SPRITESHEETS[worker_id]
    full_prompt = cfg["prompt"]

    fs = cfg.get("frame_size", 32)  # default 32 for backward compat
    print(f"   → {cfg['frames']} frames × {fs}px = {cfg['frames']*fs}x{fs} spritesheet")

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
    except Exception as e:
        print(f"❌ API error: {e}")
        return None

    msg = data.get("choices", [{}])[0].get("message", {})
    images = msg.get("images", [])

    if not images:
        print(f"❌ No image generated. Content: {msg.get('content', '')[:200]}")
        return None

    img_url = images[0].get("image_url", {}).get("url", "")
    if not img_url or not img_url.startswith("data:image"):
        print("❌ Unexpected format")
        return None

    b64_data = img_url.split(",")[1]
    raw = base64.b64decode(b64_data)
    pil_img = Image.open(io.BytesIO(raw))

    # Target: frames * fs x fs
    target_w = cfg["frames"] * fs
    target_h = fs

    # Resize to exact target
    pil_img = pil_img.resize((target_w, target_h), Image.NEAREST)

    # Save as WebP
    buf = io.BytesIO()
    pil_img.save(buf, format="WEBP", lossless=True)
    webp_b64 = base64.b64encode(buf.getvalue()).decode()

    # Save to local file
    out_path = os.path.expanduser(f"~/pixel-office/public/{cfg['key']}.webp")
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())

    print(f"   ✅ Saved: {out_path}")
    print(f"   Size: {pil_img.size[0]}x{pil_img.size[1]}px ({pil_img.size[0]//32} frames)")
    return cfg["key"]

def main():
    api_key = get_api_key()
    if not api_key or len(api_key) < 20:
        print("❌ No API key found")
        sys.exit(1)

    if len(sys.argv) > 1 and sys.argv[1] == "all":
        keys = list(SPRITESHEETS.keys())
    elif len(sys.argv) > 1:
        keys = [sys.argv[1]]
    else:
        print("Usage: python3 gen-spritesheet.py <worker_id|all>")
        print(f"Workers: {', '.join(SPRITESHEETS.keys())}")
        sys.exit(1)

    success = 0
    for wid in keys:
        key = generate_spritesheet(wid, api_key)
        if key:
            success += 1

    print(f"\n{'='*40}")
    print(f"📊 Done: {success}/{len(keys)} generated")

if __name__ == "__main__":
    main()