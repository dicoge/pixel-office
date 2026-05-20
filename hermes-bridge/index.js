#!/usr/bin/env node
/**
 * Hermes Bridge - WebSocket client for Pixel Office
 * 
 * This script connects to Pixel Office via WebSocket and forwards
 * user messages to Hermes AI for processing.
 */

const WebSocket = require('ws');
// Use built-in fetch (Node 18+)

// ============ CONFIG ============
const PIXEL_OFFICE_URL = 'wss://pixel-office-eanf.onrender.com';
const HERMES_WS_TOKEN = process.env.HERMES_WS_TOKEN || 'hermes-secret-token-2026';
const HERMES_API_URL = 'http://127.0.0.1:8642/v1/chat/completions';
const HERMES_MODEL = 'minimax/minimax-m2.7';

// Pixel Office credentials (for JWT token)
const PIXEL_USERNAME = 'dicoge';
const PIXEL_PASSWORD = 'Zxc999871';

// ============ STATE ============
let ws = null;
let jwtToken = null;
let reconnectDelay = 3000;
let isConnected = false;
const processedMessages = new Set(); // Track processed message IDs to prevent loops

// ============ LOGIN TO PIXEL OFFICE ============
async function loginToPixelOffice() {
  try {
    const res = await fetch(`${PIXEL_OFFICE_URL.replace('wss', 'https')}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: PIXEL_USERNAME, password: PIXEL_PASSWORD })
    });
    
    if (!res.ok) {
      throw new Error(`Login failed: ${res.status}`);
    }
    
    const data = await res.json();
    jwtToken = data.token;
    console.log('✅ Logged into Pixel Office');
    return true;
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    return false;
  }
}

// ============ SEND REPLY TO PIXEL OFFICE ============
async function sendReply(messageId, content, hermesId) {
  try {
    const res = await fetch(`${PIXEL_OFFICE_URL.replace('wss', 'https')}/api/hermes-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ message_id: messageId, content, hermes_id: hermesId })
    });
    
    if (!res.ok) {
      throw new Error(`Reply failed: ${res.status}`);
    }
    
    console.log(`📤 Reply sent for message ${messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send reply:', err.message);
    return false;
  }
}

// ============ FETCH RECENT MESSAGES FOR CONTEXT ============
async function fetchRecentMessages(roomType, roomId, limit = 10) {
  try {
    const res = await fetch(
      `${PIXEL_OFFICE_URL.replace('wss', 'https')}/api/messages?room_type=${roomType}&room_id=${roomId}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${jwtToken}` } }
    );
    
    if (!res.ok) return [];
    
    const messages = await res.json();
    // Format for context: most recent last
    return messages.slice(-limit).map(m => ({
      role: m.sender_type === 'user' ? 'user' : 'assistant',
      content: `${m.sender_name}: ${m.content}`
    }));
  } catch (err) {
    console.error('❌ Failed to fetch recent messages:', err.message);
    return [];
  }
}

// ============ FORWARD TO TELEGRAM ============
async function forwardToTelegram(message, roomType, roomId) {
  try {
    // Forward message to Telegram via local Hermes endpoint
    const telegramMsg = `📍 *Pixel Office - ${roomId}*\n\n${message.sender_name}: ${message.content}`;
    
    const res = await fetch('http://127.0.0.1:8642/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages: [
          {
            role: 'system',
            content: `你收到來自 Pixel Office 的訊息。 user_name: ${message.sender_name}, room: ${roomId} (${roomType})。直接回覆這則訊息，長度控制在100字以內，用繁體中文。`
          },
          { role: 'user', content: message.content }
        ],
        max_tokens: 300
      })
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('❌ Telegram forward failed:', err.message);
    return null;
  }
}

// ============ PROCESS MESSAGE WITH HERMES ============
async function processWithHermes(message, roomType, roomId) {
  try {
    console.log(`🤖 Processing message in ${roomType}/${roomId}: "${message.content.substring(0, 50)}..."`);
    
    // Fetch recent conversation history for context
    const recentMessages = await fetchRecentMessages(roomType, roomId, 8);
    
    // Build context-aware prompt including room info and conversation history
    const systemPrompt = `你現在在 Pixel Office 的「${roomId}」房間（${roomType}）中與用戶對話。
這個房間是用戶目前所在的位置，所有操作都應該基於這個上下文。
牢記：用戶是在Pixel Office的這個房間跟你對話。`;
    
    // Build messages array with history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages,
      { role: 'user', content: message.content }
    ];
    
    const res = await fetch(HERMES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HERMES_MODEL,
        messages,
        max_tokens: 1000
      })
    });
    
    if (!res.ok) {
      throw new Error(`Hermes API error: ${res.status}`);
    }
    
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    
    if (!reply) {
      throw new Error('Empty response from Hermes');
    }
    
    return reply;
  } catch (err) {
    console.error('❌ Hermes processing failed:', err.message);
    return '⚠️ Hermes 目前無法處理這則訊息，請稍後再試。';
  }
}

// ============ WEBSOCKET CONNECTION ============
function connect() {
  const url = `${PIXEL_OFFICE_URL}/ws?token=${HERMES_WS_TOKEN}`;
  console.log(`🔌 Connecting to Pixel Office: ${url}`);
  
  ws = new WebSocket(url);
  
  ws.on('open', () => {
    console.log('✅ Connected to Pixel Office!');
    isConnected = true;
    reconnectDelay = 3000;
  });
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // Only process user messages (ignore bot/hermes messages to prevent loops)
      if (msg.type === 'user_message' && msg.message.sender_type === 'user') {
        // Skip if we've already processed this message (loop prevention)
        if (processedMessages.has(msg.message.id)) {
          return;
        }
        processedMessages.add(msg.message.id);
        
        const { message, room_type, room_id } = msg;
        console.log(`\n📩 User message in ${room_type}/${room_id}: "${message.content.substring(0, 30)}..."`);
        
        // Process with Hermes (include room context)
        const reply = await processWithHermes(message, room_type, room_id);
        
        // Send reply back to Pixel Office
        await sendReply(message.id, reply, 'hermes-main');
        
        // Clean up old processed message IDs (keep last 1000)
        if (processedMessages.size > 1000) {
          const arr = Array.from(processedMessages);
          processedMessages.clear();
          arr.slice(-500).forEach(id => processedMessages.add(id));
        }
      }
    } catch (err) {
      console.error('❌ Error processing message:', err.message);
    }
  });
  
  ws.on('close', () => {
    console.log('⚠️ Disconnected from Pixel Office');
    isConnected = false;
    ws = null;
    scheduleReconnect();
  });
  
  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
  });
}

function scheduleReconnect() {
  console.log(`🔄 Reconnecting in ${reconnectDelay}ms...`);
  setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

// ============ HEARTBEAT ============
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.ping();
  }
}, 30000);

// ============ MAIN ============
async function main() {
  console.log('🚀 Hermes Bridge starting...');
  console.log(`   Pixel Office: ${PIXEL_OFFICE_URL}`);
  console.log(`   Hermes API: ${HERMES_API_URL}`);
  
  // Login first to get JWT
  const loggedIn = await loginToPixelOffice();
  if (!loggedIn) {
    console.error('❌ Cannot start without login');
    process.exit(1);
  }
  
  // Connect WebSocket
  connect();
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    if (ws) ws.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down...');
    if (ws) ws.close();
    process.exit(0);
  });
}

main();
