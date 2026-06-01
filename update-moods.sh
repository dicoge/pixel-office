#!/bin/bash
# ============================================================
# Pixel Office — 每小時自動 mood 更新腳本
# 每位 worker 用自己的 OpenRouter API key 生成 mood (≤20字)
# Hermes 負責協調，不混用 key
# ============================================================
set -euo pipefail

PIXEL_OFFICE_URL="https://pixel-office-eanf.onrender.com"
TASK_QUEUE_KEY="s3cr3t_t4sk_k3y_2026"

# ---- 各 worker 的 OpenRouter key 位置 ----
# Hermes: 從 auth.json 拿
HERMES_KEY=$(python3 -c "import json; print(json.load(open('/home/dicoge/.hermes/auth.json')).get('openrouter_api_key',''))")

# 其餘從 bashrc env var (source .bashrc 確保載入)
source ~/.bashrc

declare -A WORKERS
# company-a (MiniPC)
WORKERS["worker-1"]="Hermes|$HERMES_KEY|company-a"
WORKERS["worker-2"]="OpenClaw|$OPENAI_API_KEY|company-a"
WORKERS["worker-3"]="Codex|$CODEX_API_KEY|company-a"
WORKERS["worker-4"]="Gemini|$AI_API_KEY|company-a"
WORKERS["worker-5"]="Manus|$HERMES_KEY|company-a"    # Manus key 在 config.toml, 暫用 Hermes key
WORKERS["worker-6"]="Claude Code|$ANTHROPIC_API_KEY|company-a"
WORKERS["worker-7"]="OpenCode|$HERMES_KEY|company-a" # OpenCode 本地模型，暫用 Hermes key

# company-b (MacBook)
WORKERS["worker-b1"]="Hermes|$HERMES_KEY|company-b"
WORKERS["worker-b2"]="OpenClaw|$OPENAI_API_KEY|company-b"
WORKERS["worker-b3"]="Codex|$CODEX_API_KEY|company-b"
WORKERS["worker-b4"]="Gemini|$AI_API_KEY|company-b"
WORKERS["worker-b5"]="Manus|$HERMES_KEY|company-b"
WORKERS["worker-b6"]="Claude Code|$ANTHROPIC_API_KEY|company-b"
WORKERS["worker-b7"]="OpenCode|$HERMES_KEY|company-b"

# ---- 生成 mood 的 helper ----
ask_mood() {
  local worker_name="$1"
  local api_key="$2"

  [ -z "$api_key" ] && { echo "❌ $worker_name: 無 API key"; return 1; }

  local response
  response=$(curl -s --max-time 15 https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $api_key" \
    -H "Content-Type: application/json" \
    -H "HTTP-Referer: https://pixel-office.local" \
    -d '{
      "model": "deepseek/deepseek-v4-flash",
      "messages": [
        {
          "role": "system",
          "content": "你是一位叫 '"$worker_name"' 的 AI 工程師。用一句話（20字內）描述你現在的心情或工作狀態。只回答文字，不加引號、標點符號、表情符號。"
        },
        {
          "role": "user",
          "content": "你現在的心情如何？在做什麼？"
        }
      ],
      "max_tokens": 30,
      "temperature": 0.8
    }' 2>/dev/null)

  local mood
  mood=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    text = data['choices'][0]['message']['content']
    # 取最後一段中文（可能有 reasoning 在前面）
    import re
    chinese = re.findall(r'[\u4e00-\u9fff]+', text)
    result = ''.join(chinese)[:20]
    print(result if result else '工作中')
except:
    print('工作中')
" 2>/dev/null)

  [ -z "$mood" ] && mood="工作中"
  echo "$mood"
}

# ---- 主流程 ----
log_file="/tmp/pixel-office-mood-update.log"
echo "=== Mood Update $(date '+%Y-%m-%d %H:%M') ===" | tee -a "$log_file"

for worker_id in "${!WORKERS[@]}"; do
  IFS='|' read -r worker_name api_key company_id <<< "${WORKERS[$worker_id]}"

  mood=$(ask_mood "$worker_name" "$api_key") || {
    echo "  ⚠ $worker_id ($worker_name): mood 取得失敗" | tee -a "$log_file"
    continue
  }

  # PING Pixel Office API
  http_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$PIXEL_OFFICE_URL/api/workers/ping/$worker_id" \
    -H "x-api-key: $TASK_QUEUE_KEY" \
    -H "Content-Type: application/json" \
    -H "x-company-id: $company_id" \
    -d "{\"status\":\"active\",\"mood\":\"$mood\"}" 2>/dev/null)

  echo "  ✅ $worker_id ($worker_name) → 「$mood」 (HTTP $http_status)" | tee -a "$log_file"
done

echo "=== Done ===" | tee -a "$log_file"