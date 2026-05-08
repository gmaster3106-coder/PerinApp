// Perin Cloudflare Worker v5
// Secrets needed in Cloudflare dashboard:
//   ANTHROPIC_KEY, ELEVENLABS_KEY, OPENAI_KEY
//   SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   STRIPE_MONTHLY_PRICE_ID  ($15/month)
//   STRIPE_ANNUAL_PRICE_ID   ($99/year)

const ALLOWED_ORIGINS = [
  'https://gmaster3106-coder.github.io',
  'https://speakperin.com',
  'http://localhost',
  'http://127.0.0.1',
];

const APP_URL = 'https://speakperin.com/';
const FREE_CONVERSATION_LIMIT = 5;

// ── RATE LIMITING ──
async function checkRateLimit(env, key, limit, windowSecs) {
  if (!env.RATE_LIMIT) return false;
  try {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${key}:${Math.floor(now / windowSecs)}`;
    const current = parseInt(await env.RATE_LIMIT.get(windowKey) || '0');
    if (current >= limit) return true;
    await env.RATE_LIMIT.put(windowKey, String(current + 1), { expirationTtl: windowSecs * 2 });
    return false;
  } catch { return false; }
}

function requireRateLimit(env) {
  return !env.RATE_LIMIT;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin);
    }

    const url = new URL(request.url);
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    if (!allowed) {
      return corsResponse(JSON.stringify({ error: 'Forbidden' }), 403, origin);
    }

    if (url.pathname === '/api/webhook') {
      return handleStripeWebhook(request, env, origin);
    }

    if (url.pathname === '/api/auth/signup') {
      const signupKey = `auth_signup_${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
      if (await checkRateLimit(env, signupKey, 10, 3600)) return corsResponse(JSON.stringify({ error: 'Too many signup attempts — try again later.' }), 429, origin);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (await checkRateLimit(env, `signup:${ip}`, 5, 3600))
        return corsResponse(JSON.stringify({ error: 'Too many attempts. Try again later.' }), 429, origin);
      return handleSignup(request, env, origin);
    }
    if (url.pathname === '/api/auth/login') {
      const loginIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const loginKey = `auth_login_${loginIP}`;
      if (await checkRateLimit(env, loginKey, 20, 300)) return corsResponse(JSON.stringify({ error: 'Too many attempts — wait a few minutes and try again.' }), 429, origin);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (await checkRateLimit(env, `login:${ip}`, 10, 3600))
        return corsResponse(JSON.stringify({ error: 'Too many attempts. Try again later.' }), 429, origin);
      return handleLogin(request, env, origin);
    }
    if (url.pathname === '/api/auth/user') {
      const token = (request.headers.get('Authorization')||'').replace('Bearer ','').trim();
      if (!token) return corsResponse(JSON.stringify({error:'No token'}), 401, origin);
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': (env.SUPABASE_ANON_KEY||'').trim() }
      });
      const data = await res.json();
      return corsResponse(JSON.stringify(data), res.status, origin);
    }
    if (url.pathname === '/api/auth/reset') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (await checkRateLimit(env, `reset:${ip}`, 3, 3600))
        return corsResponse(JSON.stringify({ error: 'Too many attempts. Try again later.' }), 429, origin);
      let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({error:'Invalid JSON'}), 400, origin); }
      const { email } = body;
      if (!email) return corsResponse(JSON.stringify({error:'Email required'}), 400, origin);
      await fetch(`${env.SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': (env.SUPABASE_ANON_KEY||'').trim() },
        body: JSON.stringify({ email, redirect_to: 'https://speakperin.com/' })
      });
      return corsResponse(JSON.stringify({ ok: true }), 200, origin);
    }

    // ── TTS ──
    if (url.pathname === '/api/tts') {
      const ttsAuthHeader = request.headers.get('Authorization') || '';
      const ttsToken = ttsAuthHeader.replace('Bearer ', '').trim();
      if (!ttsToken) return corsResponse(JSON.stringify({ error: 'Authentication required' }), 401, origin);
      const ttsUser = await validateSupabaseToken(ttsToken, env);
      if (!ttsUser) return corsResponse(JSON.stringify({ error: 'Invalid token' }), 401, origin);
      if (requireRateLimit(env)) return corsResponse(JSON.stringify({ error: 'Service misconfigured' }), 503, origin);
      if (await checkRateLimit(env, `tts:${ttsUser.id}`, 200, 3600))
        return corsResponse(JSON.stringify({ error: 'Rate limit reached.' }), 429, origin);
      if (request.method !== 'POST') return corsResponse(JSON.stringify({ error: 'POST only' }), 405, origin);
      if (!env.ELEVENLABS_KEY) return corsResponse(JSON.stringify({ error: 'Key not configured' }), 500, origin);
      let body;
      try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin); }
      const { text, voice_id, model_id = 'eleven_multilingual_v2', language_code } = body;
      if (!text || !voice_id) return corsResponse(JSON.stringify({ error: 'text and voice_id required' }), 400, origin);
      if (text.length > 1000) return corsResponse(JSON.stringify({ error: 'Text too long' }), 400, origin);
      const voiceSettings = { stability: 0.50, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false };
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_KEY },
        body: JSON.stringify({ text, model_id, ...(language_code ? { language_code } : {}), voice_settings: voiceSettings }),
      });
      if (!response.ok) return corsResponse(JSON.stringify({ error: 'TTS error' }), response.status, origin);
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Access-Control-Allow-Origin': ALLOWED_ORIGINS.some(o => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0],
        },
      });
    }

    // ── EXTRACT JWT ──
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    let userId = null, userEmail = null;
    if (token) {
      const user = await validateSupabaseToken(token, env);
      if (user) { userId = user.id; userEmail = user.email; }
    }

    // ── SUBSCRIPTION ENDPOINTS ──
    if (url.pathname === '/api/subscription')    return handleGetSubscription(request, env, origin, userId);
    if (url.pathname === '/api/increment-usage') return handleIncrementUsage(request, env, origin, userId);
    if (url.pathname === '/api/create-checkout') return handleCreateCheckout(request, env, origin, userId, userEmail);

    // ── DELETE ACCOUNT ──
    if (url.pathname === '/api/delete-account') {
      if (request.method !== 'POST') return corsResponse('', 204, origin);
      if (!userId) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401, origin);
      try {
        const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        });
        if (!res.ok) {
          const err = await res.text();
          return corsResponse(JSON.stringify({ error: err }), res.status, origin);
        }
        return corsResponse(JSON.stringify({ ok: true }), 200, origin);
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500, origin);
      }
    }

    // ── CRASH REPORTS ──
    if (url.pathname === '/crash') {
      if (request.method !== 'POST') return corsResponse('', 204, origin);
      try {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (await checkRateLimit(env, `crash:${ip}`, 20, 3600))
          return corsResponse('', 204, origin);
        const body = await request.json().catch(() => null);
        if (body && env.RATE_LIMIT) {
          const key = `crash_log:${Date.now()}:${ip}`;
          const safe = {
            t: body.t || Date.now(),
            type: String(body.type || '').slice(0, 20),
            msg: String(body.msg || '').slice(0, 300),
            detail: body.detail ? String(body.detail).slice(0, 300) : null,
            url: String(body.url || '').slice(0, 100),
            ip,
          };
          await env.RATE_LIMIT.put(key, JSON.stringify(safe), { expirationTtl: 604800 });
        }
      } catch(e) {}
      return corsResponse('', 204, origin);
    }

    // ── RATE LIMITING ──
    if (env.RATE_LIMIT) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const route = url.pathname.replace('/api/', '');
      const LIMITS = { chat: { perMinute: 12, perHour: 80 }, tts: { perMinute: 15, perHour: 120 }, stt: { perMinute: 15, perHour: 120 } };
      const limits = LIMITS[route];
      if (limits) {
        const now = Math.floor(Date.now() / 1000);
        const minKey = `${ip}:${route}:min:${Math.floor(now / 60)}`;
        const hrKey  = `${ip}:${route}:hr:${Math.floor(now / 3600)}`;
        const [minCount, hrCount] = await Promise.all([env.RATE_LIMIT.get(minKey), env.RATE_LIMIT.get(hrKey)]);
        if (parseInt(minCount || '0') >= limits.perMinute) return corsResponse(JSON.stringify({ error: 'Too many requests — slow down' }), 429, origin);
        if (parseInt(hrCount  || '0') >= limits.perHour)   return corsResponse(JSON.stringify({ error: 'Hourly limit reached — try again later' }), 429, origin);
        await Promise.all([
          env.RATE_LIMIT.put(minKey, String(parseInt(minCount || '0') + 1), { expirationTtl: 120 }),
          env.RATE_LIMIT.put(hrKey,  String(parseInt(hrCount  || '0') + 1), { expirationTtl: 7200 }),
        ]);
      }
    }

    // ── REQUIRE AUTH ──
    if (!userId) {
      return corsResponse(JSON.stringify({ error: 'Authentication required', code: 'AUTH_REQUIRED' }), 401, origin);
    }

    // ── ANTHROPIC CHAT ──
    if (url.pathname === '/api/chat' || url.pathname === '/') {
      if (requireRateLimit(env)) return corsResponse(JSON.stringify({ error: 'Service misconfigured' }), 503, origin);
      if (await checkRateLimit(env, `chat:${userId}`, 100, 3600))
        return corsResponse(JSON.stringify({ error: 'Rate limit reached. Try again in an hour.' }), 429, origin);
      if (request.method !== 'POST') return corsResponse(JSON.stringify({ error: 'POST only' }), 405, origin);
      if (!env.ANTHROPIC_KEY) return corsResponse(JSON.stringify({ error: 'Key not configured' }), 500, origin);
      let body;
      try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin); }
      if (body.max_tokens && body.max_tokens > 2500) body.max_tokens = 2500;
      const ALLOWED_MODELS = ['claude-haiku-4-5-20251001','claude-sonnet-4-6','claude-sonnet-4-5','claude-haiku-3-5-20241022'];
      if (body.model && !ALLOWED_MODELS.includes(body.model)) body.model = 'claude-haiku-4-5-20251001';
      const safeBody = {
        model: body.model || 'claude-haiku-4-5-20251001',
        max_tokens: body.max_tokens || 700,
        stream: !!body.stream,
        system: typeof body.system === 'string' ? body.system.slice(0, 12000) : undefined,
        messages: Array.isArray(body.messages) ? body.messages.slice(-50) : [],
      };
      if (!safeBody.system) delete safeBody.system;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(safeBody),
      });
      if (safeBody.stream) {
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Access-Control-Allow-Origin': ALLOWED_ORIGINS.some(o => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0],
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }
      const data = await response.json();
      return corsResponse(JSON.stringify(data), response.status, origin);
    }

    // ── MEMORY MOMENTS ──
    if (url.pathname === '/api/memory') {
      if (request.method === 'GET') {
        const lang = url.searchParams.get('lang') || '';
        const dialect = url.searchParams.get('dialect') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 200);
        if (!userId) return corsResponse(JSON.stringify({ error: 'Auth required' }), 401, origin);
        const res = await fetch(
          `${env.SUPABASE_URL}/rest/v1/memory_moments?user_id=eq.${userId}&lang=eq.${encodeURIComponent(lang)}&dialect=eq.${encodeURIComponent(dialect)}&sr_due=lte.${new Date().toISOString()}&order=sr_due.asc&limit=${limit}`,
          { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
        );
        const data = await res.json();
        return corsResponse(JSON.stringify(data), 200, origin);
      }
      if (request.method === 'POST') {
        if (!userId) return corsResponse(JSON.stringify({ error: 'Auth required' }), 401, origin);
        let body;
        try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin); }
        const moments = Array.isArray(body) ? body.slice(0, 20) : [body];
        const ALLOWED_MEMORY_FIELDS = ['phrase','phrase_norm','translation','lang','dialect','source_scenario','source_session_id','context','encounter_type','user_produced','emotional_tag','hesitation_ms','sr_due','sr_interval_days','sr_reps','sr_ease','sr_last_result','created_at','last_seen_at','times_seen','times_used'];
        const rows = moments.map(m => {
          const safe = { user_id: userId };
          for (const f of ALLOWED_MEMORY_FIELDS) if (m[f] !== undefined) safe[f] = m[f];
          return safe;
        });
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/memory_moments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(rows),
        });
        return corsResponse(JSON.stringify({ ok: res.ok }), res.ok ? 200 : 500, origin);
      }
      if (request.method === 'PATCH') {
        if (!userId) return corsResponse(JSON.stringify({ error: 'Auth required' }), 401, origin);
        let body;
        try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin); }
        const { phrase_norm, lang, dialect, sr_due, sr_interval_days, sr_reps, sr_ease, sr_last_result, times_seen, last_seen_at, user_produced, last_used_by_user_at, times_used } = body;
        if (!phrase_norm || !lang) return corsResponse(JSON.stringify({ error: 'phrase_norm and lang required' }), 400, origin);
        const updates = { sr_due, sr_interval_days, sr_reps, sr_ease, sr_last_result, times_seen, last_seen_at };
        if (user_produced !== undefined) { updates.user_produced = user_produced; updates.last_used_by_user_at = last_used_by_user_at; updates.times_used = times_used; }
        const res = await fetch(
          `${env.SUPABASE_URL}/rest/v1/memory_moments?user_id=eq.${userId}&phrase_norm=eq.${encodeURIComponent(phrase_norm)}&lang=eq.${encodeURIComponent(dialect)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
            body: JSON.stringify(updates),
          }
        );
        return corsResponse(JSON.stringify({ ok: res.ok }), 200, origin);
      }
    }

    // ── CRASH LOGS (admin only) ──
    if (url.pathname === '/api/crash-logs') {
      if (!userId) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401, origin);
      const ADMIN_IDS = (env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!ADMIN_IDS.includes(userId)) return corsResponse(JSON.stringify({ error: 'Forbidden' }), 403, origin);
      try {
        const list = await env.RATE_LIMIT.list({ prefix: 'crash_log:', limit: 50 });
        const logs = await Promise.all(
          list.keys.map(async k => {
            const val = await env.RATE_LIMIT.get(k.name);
            try { return JSON.parse(val); } catch { return null; }
          })
        );
        return corsResponse(JSON.stringify({ logs: logs.filter(Boolean).reverse() }), 200, origin);
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500, origin);
      }
    }

    if (url.pathname === '/api/stt') {
      if (request.method !== 'POST') return corsResponse(JSON.stringify({ error: 'POST only' }), 405, origin);
      if (!env.OPENAI_KEY) return corsResponse(JSON.stringify({ error: 'Key not configured' }), 500, origin);
      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > 5000000) return corsResponse(JSON.stringify({ error: 'Audio too large' }), 413, origin);
      const formData = await request.formData();
      const file = formData.get('file');
      const rawLanguage = formData.get('language') || '';
      const language = rawLanguage.replace(/[^a-zA-Z-]/g, '').slice(0, 10);
      if (!file) return corsResponse(JSON.stringify({ error: 'audio file required' }), 400, origin);
      if (file.size && file.size > 5000000) return corsResponse(JSON.stringify({ error: 'Audio too large' }), 413, origin);
      const rawPrompt = formData.get('prompt') || '';
      const prompt = String(rawPrompt).slice(0, 200); // Whisper prompt hint
      const outForm = new FormData();
      outForm.append('file', file);
      outForm.append('model', 'whisper-1');
      outForm.append('response_format', 'verbose_json');
      if (language) outForm.append('language', language);
      if (prompt) outForm.append('prompt', prompt);
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.OPENAI_KEY}` },
        body: outForm,
      });
      const data = await response.json();
      return corsResponse(JSON.stringify(data), response.status, origin);
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404, origin);
  }
};

// ── VALIDATE SUPABASE TOKEN ──
async function validateSupabaseToken(token, env) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── GET USER PROFILE ──
async function getUserProfile(userId, env) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
    });
    const data = await res.json();
    return data?.[0] || null;
  } catch { return null; }
}

// ── HANDLE SIGNUP ──
async function handleSignup(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin); }
  const { email, password } = body;
  if (!email || !password) return corsResponse(JSON.stringify({ error: 'Email and password required' }), 400, origin);
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': (env.SUPABASE_ANON_KEY||'').trim(), 'Authorization': `Bearer ${(env.SUPABASE_ANON_KEY||'').trim()}` },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.user?.id) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({ id: data.user.id, email: data.user.email, subscription_status: 'free', conversations_used: 0 }),
    });
  }
  if (res.ok && !data.user?.id && !data.error && !data.access_token) {
    return corsResponse(JSON.stringify({ error: 'email_already_registered', message: 'An account with this email already exists.' }), 200, origin);
  }
  return corsResponse(JSON.stringify(data), res.status, origin);
}

// ── HANDLE LOGIN ──
async function handleLogin(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin); }
  const { email, password } = body;
  if (!email || !password) return corsResponse(JSON.stringify({ error: 'Email and password required' }), 400, origin);
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': (env.SUPABASE_ANON_KEY||'').trim(), 'Authorization': `Bearer ${(env.SUPABASE_ANON_KEY||'').trim()}` },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return corsResponse(JSON.stringify(data), res.status, origin);
}

// ── GET SUBSCRIPTION ──
async function handleGetSubscription(request, env, origin, userId) {
  if (!userId) return corsResponse(JSON.stringify({ status: 'free', conversations_used: 0 }), 200, origin);
  const profile = await getUserProfile(userId, env);
  if (!profile) return corsResponse(JSON.stringify({ status: 'free', conversations_used: 0 }), 200, origin);
  return corsResponse(JSON.stringify({
    status: profile.subscription_status || 'free',
    conversations_used: profile.conversations_used || 0,
  }), 200, origin);
}

// ── INCREMENT USAGE ──
async function handleIncrementUsage(request, env, origin, userId) {
  if (!userId) return corsResponse(JSON.stringify({ error: 'Auth required' }), 401, origin);
  const profile = await getUserProfile(userId, env);
  if (!profile) return corsResponse(JSON.stringify({ error: 'Profile not found' }), 404, origin);
  if (profile.subscription_status === 'pro') {
    return corsResponse(JSON.stringify({ status: 'pro', conversations_used: profile.conversations_used || 0 }), 200, origin);
  }
  const newCount = (profile.conversations_used || 0) + 1;
  await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ conversations_used: newCount }),
  });
  return corsResponse(JSON.stringify({
    status: 'free',
    conversations_used: newCount,
    limit_reached: newCount >= FREE_CONVERSATION_LIMIT,
  }), 200, origin);
}

// ── CREATE STRIPE CHECKOUT ──
async function handleCreateCheckout(request, env, origin, userId, userEmail) {
  if (!userId) return corsResponse(JSON.stringify({ error: 'Auth required' }), 401, origin);
  if (!env.STRIPE_SECRET_KEY) return corsResponse(JSON.stringify({ error: 'Stripe not configured' }), 500, origin);

  let body = {};
  try { body = await request.json(); } catch { /* default to monthly */ }
  const interval = body.interval === 'year' ? 'year' : 'month';

  const priceId = interval === 'year'
    ? (env.STRIPE_ANNUAL_PRICE_ID || env.STRIPE_PRICE_ID)
    : (env.STRIPE_MONTHLY_PRICE_ID || env.STRIPE_PRICE_ID);

  if (!priceId) return corsResponse(JSON.stringify({ error: 'Price not configured' }), 500, origin);

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${APP_URL}?upgrade=success`,
    cancel_url: `${APP_URL}?upgrade=cancelled`,
    'metadata[user_id]': userId,
    'metadata[interval]': interval,
    client_reference_id: userId,
    'subscription_data[cancel_at_period_end]': 'false',
  });
  if (userEmail) params.set('customer_email', userEmail);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const session = await res.json();
  if (!res.ok) return corsResponse(JSON.stringify({ error: session.error?.message || 'Checkout failed' }), res.status, origin);
  return corsResponse(JSON.stringify({ url: session.url }), 200, origin);
}

// ── STRIPE WEBHOOK ──
async function handleStripeWebhook(request, env, origin) {
  const payload = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  if (env.STRIPE_WEBHOOK_SECRET && sig) {
    const isValid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      return corsResponse(JSON.stringify({ error: 'Invalid signature' }), 400, origin);
    }
  }

  let event;
  try { event = JSON.parse(payload); } catch { return corsResponse(JSON.stringify({ error: 'Invalid payload' }), 400, origin); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (userId && session.payment_status === 'paid') {
      await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ subscription_status: 'pro', stripe_customer_id: session.customer, stripe_subscription_id: session.subscription }),
      });
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    if (sub.status === 'canceled' || (sub.cancel_at_period_end && sub.status !== 'active')) {
      const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${sub.customer}&select=id`, {
        headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
      });
      const profiles = await profileRes.json();
      if (profiles?.[0]) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${profiles[0].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ subscription_status: 'free' }),
        });
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${sub.customer}&select=id`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` },
    });
    const profiles = await profileRes.json();
    if (profiles?.[0]) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${profiles[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ subscription_status: 'free' }),
      });
    }
  }

  return corsResponse(JSON.stringify({ received: true }), 200, origin);
}

// ── STRIPE SIGNATURE VERIFICATION ──
async function verifyStripeSignature(payload, sigHeader, secret) {
  try {
    const parts = sigHeader.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (age > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const computed = new Uint8Array(mac);
    const expected = new Uint8Array(signature.match(/.{2}/g).map(b => parseInt(b, 16)));
    if (computed.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < computed.length; i++) mismatch |= computed[i] ^ expected[i];
    return mismatch === 0;
  } catch { return false; }
}

function corsResponse(body, status = 200, origin = '*') {
  const allowedOrigin = ALLOWED_ORIGINS.some(o => (origin || '').startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
