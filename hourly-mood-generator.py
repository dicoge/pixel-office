#!/usr/bin/env python3
"""Pixel Office — Hourly Mood Generator (v5, stable)
"""
import json, os, re, sys, time, urllib.request, urllib.error

PIXEL_OFFICE_URL = "https://pixel-office-eanf.onrender.com"
TASK_QUEUE_KEY = "s3cr3t_t4sk_k3y_2026"

def get_openrouter_key():
    try:
        with open("/home/dicoge/.hermes/auth.json") as f:
            data = json.load(f)
        for cred in data.get("credential_pool", {}).get("openrouter", []):
            if cred.get("label") == "OPENROUTER_API_KEY":
                token = cred.get("access_token", "")
                if token and token != "***" and len(token) == 73:
                    return token
    except Exception as e:
        print(f"⚠ auth.json 讀取失敗: {e}", file=sys.stderr)
    return None

API_KEY = get_openrouter_key()

def ask_mood(worker_name):
    """Generate mood, returns (mood_str|None, error_msg|None)"""
    for attempt in range(3):
        payload = json.dumps({
            "model": "deepseek/deepseek-v4-flash",
            "messages": [
                {"role": "system", "content": f"你是一位叫 {worker_name} 的 AI 工程師。用一句話（20字內）描述你現在的心情或工作狀態。只回答中文文字，不加引號標點符號表情符號。"},
                {"role": "user", "content": "你現在的心情如何？在做什麼？"}
            ],
            "max_tokens": 30,
            "temperature": 0.85
        }).encode("utf-8")
        
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://pixel-office.local",
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read())
            text = data["choices"][0]["message"]["content"] or ""
            chinese = re.findall(r'[\u4e00-\u9fff]+', text)
            result = "".join(chinese)[:20]
            return (result if result else "工作中", None)
        except urllib.error.HTTPError as e:
            body = e.fp.read().decode() if e.fp else ""
            if e.code == 429 and attempt < 2:
                time.sleep(8 * (attempt + 1))
                continue
            return (None, f"HTTP {e.code}: {body[:80]}")
        except Exception as e:
            if attempt < 2:
                time.sleep(5)
                continue
            return (None, f"{type(e).__name__}: {e}")

def ping_worker(worker_id, mood, company_id):
    payload = json.dumps({"status": "active", "mood": mood}).encode("utf-8")
    req = urllib.request.Request(
        f"{PIXEL_OFFICE_URL}/api/workers/ping/{worker_id}",
        data=payload,
        headers={
            "x-api-key": TASK_QUEUE_KEY,
            "Content-Type": "application/json",
            "x-company-id": company_id,
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0

def main():
    global API_KEY
    if not API_KEY:
        print("❌ 無法取得有效的 OpenRouter API key")
        sys.exit(1)
    print(f"🔑 使用 API key: {API_KEY[:8]}... (len={len(API_KEY)})")
    
    workers = [
        ("worker-1",  "Hermes"),
        ("worker-2",  "OpenClaw"),
        ("worker-3",  "Codex"),
        ("worker-4",  "Gemini"),
        ("worker-5",  "Manus"),
        ("worker-6",  "Claude Code"),
        ("worker-7",  "OpenCode"),
        ("worker-b1", "Hermes"),
        ("worker-b2", "OpenClaw"),
        ("worker-b3", "Codex"),
        ("worker-b4", "Gemini"),
        ("worker-b5", "Manus"),
        ("worker-b6", "Claude Code"),
        ("worker-b7", "OpenCode"),
    ]
    
    timestamp = os.popen("date '+%Y-%m-%d %H:%M'").read().strip()
    log_lines = [f"=== Mood Update {timestamp} ==="]
    results = {}
    
    for i, (worker_id, worker_name) in enumerate(workers):
        company = "company-a" if not worker_id.startswith("worker-b") else "company-b"
        if i > 0:
            time.sleep(3.5)
        
        mood, error = ask_mood(worker_name)
        if mood is None:
            print(f"  ⚠ {worker_id} ({worker_name}): {error}")
            log_lines.append(f"  ⚠ {worker_id} ({worker_name}): {error}")
            results[worker_id] = ("失敗", 0)
            continue
        
        http_status = ping_worker(worker_id, mood, company)
        icon = "✅" if http_status == 200 else "⚠"
        print(f"  {icon} {worker_id} ({worker_name}) → 「{mood}」 (HTTP {http_status})")
        log_lines.append(f"  {icon} {worker_id} ({worker_name}) → 「{mood}」 (HTTP {http_status})")
        results[worker_id] = (mood, http_status)
    
    log_lines.append("=== Done ===")
    with open("/tmp/pixel-office-mood-update.log", "a") as f:
        f.write("\n".join(log_lines) + "\n")
    
    a_res = sorted([(k,v) for k,v in results.items() if not k.startswith("worker-b")])
    b_res = sorted([(k,v) for k,v in results.items() if k.startswith("worker-b")])
    
    print(f"\n── 🏢 Pixel Office 員工心情報表 — {timestamp} ──")
    print(f"   公司 A (MiniPC)          │ 公司 B (MacBook)")
    print(f"   ─────────────────────────┼─────────────────────────")
    for (a_id, (a_m, a_s)), (b_id, (b_m, b_s)) in zip(a_res, b_res):
        an = a_id.split("-")[1].rjust(2)
        bn = "b" + b_id.split("-")[1][1:].rjust(2)
        ai = "✅" if a_s == 200 else "⚠️"
        bi = "✅" if b_s == 200 else "⚠️"
        am = a_m[:14] if a_m not in ("失敗",) else a_m
        bm = b_m[:14] if b_m not in ("失敗",) else b_m
        print(f"   {ai} {an} 「{am}」 │ {bi} {bn} 「{bm}」")
    
    success = sum(1 for v in results.values() if v[1] == 200)
    total = len(results)
    print(f"\n📊 成功率: {success}/{total} ({100*success//total}%)")

if __name__ == "__main__":
    main()