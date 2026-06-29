'use strict';

// ── State ──
let currentFeature = 'general';
let history        = [];
let streaming      = false;
let heroVisible    = true;
let sessionProducts = []; // tracks products discussed this session

// ── Capability descriptions ──
const CAPABILITIES = {
  general: null,
  price_intelligence: {
    verdict: 'Is now the right time?',
    label:   'Price Intelligence',
    desc:    'Tell me what you want to buy. I\'ll tell you if today\'s price is fair, what the floor is, and whether to buy now or wait.',
    hint:    'Try: "Should I buy AirPods Pro right now?"',
  },
  monitor: {
    verdict: 'I\'ll watch it for you',
    label:   'Buy It For Me',
    desc:    'Give me a product and a target price. I\'ll track it and tell you the exact right moment to act.',
    hint:    'Try: "Watch the MacBook Air M3 and tell me when to buy"',
  },
  negotiate: {
    verdict: 'Let\'s get you a lower price',
    label:   'Get a Discount',
    desc:    'Tell me what you found and where. I\'ll write you a price match script you can copy and send right now.',
    hint:    'Try: "Help me negotiate a lower price on an LG TV at Best Buy"',
  },
  collective: {
    verdict: 'Better together',
    label:   'Group Buy',
    desc:    'Tell me what you want. I\'ll show you how to pool demand and approach retailers for a bulk deal.',
    hint:    'Try: "Can we get a group deal on the Dyson V15?"',
  },
  life_event: {
    verdict: 'Plan around your timeline',
    label:   'Life Event',
    desc:    'Tell me what\'s coming up and when. I\'ll build a shopping plan that hits every item at the right time.',
    hint:    'Try: "I\'m moving to Austin on Aug 15 — what should I buy and when?"',
  },
  procurement: {
    verdict: 'I\'ll handle the whole thing',
    label:   'Full Purchase',
    desc:    'Describe what you need. I\'ll research the best option, find where to buy it, and walk you through every step.',
    hint:    'Try: "Get my daughter a college laptop, $800–$1000, ready by August"',
  },
  fulfillment: {
    verdict: 'After you buy',
    label:   'Order Help',
    desc:    'Tell me what you ordered. I\'ll help you track it, claim a price drop refund, or handle a return.',
    hint:    'Try: "I bought a TV last week — can I get money back if the price dropped?"',
  },
};

// ── DOM ──
const heroEl     = document.getElementById('hero');
const heroInput  = document.getElementById('hero-input');
const heroSend   = document.getElementById('hero-send');
const messagesEl = document.getElementById('messages');
const chatBar    = document.getElementById('chat-bar');
const chatInput  = document.getElementById('chat-input');
const chatSend   = document.getElementById('chat-send');
const clearBtn   = document.getElementById('clear-btn');

// ── Right panel ──
function updateRightPanel(feature) {
  const cap         = CAPABILITIES[feature] || null;
  const hubCap      = document.getElementById('hub-capability');
  const hubCapLbl   = document.getElementById('hub-cap-label');
  const hubCapDesc  = document.getElementById('hub-cap-desc');
  const hubCapHint  = document.getElementById('hub-cap-hint');
  const verdictEmpty = document.getElementById('verdict-empty-state');
  const verdictData  = document.getElementById('verdict-data-state');

  // Reset to empty state first
  verdictEmpty.classList.remove('hidden');
  verdictData.classList.add('hidden');

  if (!cap) {
    hubCap.classList.add('hidden');
  } else {
    hubCap.classList.remove('hidden');
    hubCapLbl.textContent  = cap.label;
    hubCapDesc.textContent = cap.desc;
    hubCapHint.textContent = cap.hint;
  }
}

// ── Update right panel with real data from Claude ──
function applyVerdictData(data) {
  if (!data || data.verdict === 'none' || !data.product) return;

  const verdictEmpty = document.getElementById('verdict-empty-state');
  const verdictData  = document.getElementById('verdict-data-state');
  const hubCap       = document.getElementById('hub-capability');
  const badge        = document.getElementById('verdict-badge');
  const productEl    = document.getElementById('verdict-product');
  const priceEl      = document.getElementById('vrow-price-val');
  const storeEl      = document.getElementById('vrow-store-val');
  const timelineEl   = document.getElementById('vrow-timeline-val');
  const confEl       = document.getElementById('vrow-conf-val');
  const vrowPrice    = document.getElementById('vrow-price');
  const vrowStore    = document.getElementById('vrow-store');
  const vrowTimeline = document.getElementById('vrow-timeline');
  const vrowConf     = document.getElementById('vrow-conf');

  // Set badge
  const verdictMap = {
    buy:       { label: 'Buy Now',   cls: 'badge-buy' },
    wait:      { label: 'Wait',      cls: 'badge-wait' },
    negotiate: { label: 'Negotiate', cls: 'badge-negotiate' },
    research:  { label: 'Learn More', cls: 'badge-research' },
  };
  const v = verdictMap[data.verdict] || { label: data.verdict, cls: 'badge-research' };
  badge.textContent = v.label;
  badge.className   = `verdict-badge ${v.cls}`;

  // Set product
  productEl.textContent = data.product;

  // Set data rows — hide rows with no data
  const priceRange = [data.price_low, data.price_high].filter(Boolean).join(' – ');
  if (priceRange) {
    priceEl.textContent = priceRange;
    vrowPrice.classList.remove('hidden');
  } else {
    vrowPrice.classList.add('hidden');
  }

  if (data.best_store) {
    storeEl.textContent = data.best_store;
    vrowStore.classList.remove('hidden');
  } else {
    vrowStore.classList.add('hidden');
  }

  if (data.timeline && data.verdict === 'wait') {
    timelineEl.textContent = data.timeline;
    vrowTimeline.classList.remove('hidden');
  } else {
    vrowTimeline.classList.add('hidden');
  }

  if (data.confidence && data.confidence !== 'none') {
    confEl.textContent = data.confidence.charAt(0).toUpperCase() + data.confidence.slice(1);
    vrowConf.classList.remove('hidden');
  } else {
    vrowConf.classList.add('hidden');
  }

  // Show verdict data, hide empty state and capability card
  verdictEmpty.classList.add('hidden');
  verdictData.classList.remove('hidden');
  hubCap.classList.add('hidden');

  // Add to session rail
  addSessionCard(data);

  // Wire copy button
  const copyBtn = document.getElementById('copy-verdict-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      const parts = [
        `${data.product}`,
        `Verdict: ${v.label}`,
        data.price_low && data.price_high ? `Price: ${data.price_low} – ${data.price_high}` : '',
        data.best_store ? `Best at: ${data.best_store}` : '',
        data.timeline && data.verdict === 'wait' ? `Wait time: ${data.timeline}` : '',
      ].filter(Boolean).join('\n');
      navigator.clipboard.writeText(parts).then(() => {
        copyBtn.style.color = 'var(--teal)';
        setTimeout(() => { copyBtn.style.color = ''; }, 1500);
      });
    };
  }
}

// ── Session left rail ──
function addSessionCard(data) {
  if (!data.product) return;

  // Don't duplicate — update existing card if same product
  const existing = sessionProducts.find(p => p.product === data.product);
  if (existing) {
    existing.verdict    = data.verdict;
    existing.price_low  = data.price_low;
    existing.price_high = data.price_high;
    existing.best_store = data.best_store;
  } else {
    sessionProducts.push({ ...data, time: Date.now() });
  }
  renderSessionCards();
  saveSession();
}

function renderSessionCards() {
  const container  = document.getElementById('session-cards');
  const emptyState = document.getElementById('session-empty');
  if (!container) return;

  if (sessionProducts.length === 0) {
    emptyState.classList.remove('hidden');
    container.innerHTML = '';
    updateTopbarCount();
    return;
  }

  emptyState.classList.add('hidden');

  const verdictMap = {
    buy:       { label: 'Buy Now',    cls: 'sc-badge-buy' },
    wait:      { label: 'Wait',       cls: 'sc-badge-wait' },
    negotiate: { label: 'Negotiate',  cls: 'sc-badge-negotiate' },
    research:  { label: 'Research',   cls: 'sc-badge-research' },
    none:      { label: '',           cls: '' },
  };

  container.innerHTML = sessionProducts.slice().reverse().map(p => {
    const v = verdictMap[p.verdict] || { label: '', cls: '' };
    const priceRange = [p.price_low, p.price_high].filter(Boolean).join(' – ');
    const ago = timeAgo(p.time);
    return `
      <article class="sc-card">
        <div class="sc-header">
          <span class="sc-name">${escHtml(p.product)}</span>
          ${v.label ? `<span class="sc-badge ${v.cls}">${v.label}</span>` : ''}
        </div>
        ${priceRange ? `<span class="sc-price">${escHtml(priceRange)}</span>` : ''}
        ${p.best_store ? `<span class="sc-store">${escHtml(p.best_store)}</span>` : ''}
        <span class="sc-time">${ago}</span>
      </article>
    `;
  }).join('');
  updateTopbarCount();
}

function updateTopbarCount() {
  const label = document.getElementById('agent-count-label');
  if (!label) return;
  const n = sessionProducts.length;
  label.textContent = n === 0
    ? 'Your shopping advisor'
    : n === 1
      ? 'Tracking 1 product this session'
      : `Tracking ${n} products this session`;
}

function saveSession() {
  try {
    localStorage.setItem('br_session_products', JSON.stringify(sessionProducts));
    localStorage.setItem('br_history', JSON.stringify(history));
  } catch {}
}

function loadSession() {
  try {
    const prods = localStorage.getItem('br_session_products');
    const hist  = localStorage.getItem('br_history');
    if (prods) sessionProducts = JSON.parse(prods);
    if (hist)  history          = JSON.parse(hist);
  } catch {}
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── Capability pill binding ──
function bindPillGroup(navEl) {
  navEl.querySelectorAll('.cap-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      navEl.querySelectorAll('.cap-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setFeature(btn.dataset.feature, btn.dataset.ph);
    });
  });
}
document.querySelectorAll('.cap-nav').forEach(bindPillGroup);

function setFeature(feature, placeholder) {
  currentFeature = feature;
  document.querySelectorAll(`.cap-pill[data-feature="${feature}"]`).forEach(b => {
    b.closest('.cap-nav')?.querySelectorAll('.cap-pill').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  });
  if (placeholder) {
    heroInput.placeholder = placeholder;
    chatInput.placeholder = placeholder;
  }
  // Only update right panel if no verdict data is showing
  const verdictData = document.getElementById('verdict-data-state');
  if (verdictData && verdictData.classList.contains('hidden')) {
    updateRightPanel(feature);
  }
}

// Initialise right panel
loadSession();
renderSessionCards();
if (sessionProducts.length > 0) {
  const last = sessionProducts[sessionProducts.length - 1];
  applyVerdictData(last);
}
updateRightPanel('general');

// ── Quick suggestion cards ──
document.querySelectorAll('.suggestion-card').forEach(card => {
  card.addEventListener('click', () => {
    const ph = document.querySelector(`.cap-pill[data-feature="${card.dataset.feature}"]`)?.dataset.ph;
    setFeature(card.dataset.feature, ph);
    submitMessage(card.dataset.msg);
  });
});

// ── New Session ──
clearBtn.addEventListener('click', () => {
  history         = [];
  sessionProducts = [];
  try { localStorage.removeItem('br_session_products'); localStorage.removeItem('br_history'); } catch {}
  renderSessionCards();
  updateRightPanel('general');
  setFeature('general', null);
  if (!heroVisible) {
    heroVisible = true;
    heroEl.classList.remove('hidden');
    messagesEl.classList.add('hidden');
    chatBar.classList.add('hidden');
    messagesEl.innerHTML = '';
  }
});

// ── Input helpers ──
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}
heroInput.addEventListener('input',   () => { autoResize(heroInput); heroSend.disabled = !heroInput.value.trim() || streaming; });
heroInput.addEventListener('keydown', e  => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!heroSend.disabled) submitMessage(heroInput.value.trim()); } });
heroSend.addEventListener('click',    () => { if (!heroSend.disabled) submitMessage(heroInput.value.trim()); });

chatInput.addEventListener('input',   () => { autoResize(chatInput); chatSend.disabled = !chatInput.value.trim() || streaming; });
chatInput.addEventListener('keydown', e  => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!chatSend.disabled) submitMessage(chatInput.value.trim()); } });
chatSend.addEventListener('click',    () => { if (!chatSend.disabled) submitMessage(chatInput.value.trim()); });

// ── Core send ──
async function submitMessage(text) {
  if (!text || streaming) return;

  if (heroVisible) {
    heroVisible = false;
    heroEl.classList.add('hidden');
    messagesEl.classList.remove('hidden');
    chatBar.classList.remove('hidden');
    heroInput.value = '';
    heroInput.style.height = 'auto';
    heroSend.disabled = true;
  }

  appendMsg('user', text);
  history.push({ role: 'user', content: text });
  chatInput.value = '';
  chatInput.style.height = 'auto';
  chatSend.disabled = true;
  streaming = true;

  const typingEl = appendTyping();

  try {
    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ feature: currentFeature, message: text, history: history.slice(0, -1) }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);

    typingEl.remove();
    const msgEl  = appendMsg('assistant', '');
    const msgBody = msgEl.querySelector('.msg-body');
    const bubble  = msgEl.querySelector('.bubble');

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      // Show text without the data block during streaming
      bubble.innerHTML = renderMd(stripDataBlock(full));
      scrollDown();
    }

    // Parse the data block
    const data = extractDataBlock(full);
    const cleanText = stripDataBlock(full);
    history.push({ role: 'assistant', content: cleanText });
    saveSession();

    // Apply data to right panel and session rail
    if (data) applyVerdictData(data);

    // Extract and render follow-up chips
    const chips = extractFollowUps(cleanText);
    if (chips.length) {
      const cutIdx = findFollowUpStart(cleanText);
      const bodyOnly = cutIdx > 0 ? cleanText.slice(0, cutIdx).trim() : cleanText;
      bubble.innerHTML = renderMd(bodyOnly);
      msgBody.appendChild(buildChips(chips));
    } else {
      bubble.innerHTML = renderMd(cleanText);
    }

    // Add feedback buttons below the message
    const feedbackEl = buildFeedback(data, cleanText);
    msgBody.appendChild(feedbackEl);
    scrollDown();

  } catch (err) {
    typingEl?.remove();
    appendMsg('assistant', `Something went wrong. ${err.message}`);
  } finally {
    streaming = false;
    chatSend.disabled = !chatInput.value.trim();
  }
}

// ── Data block parsing ──
function extractDataBlock(text) {
  const match = text.match(/<!--BUYRIGHT:([\s\S]*?)-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function stripDataBlock(text) {
  return text.replace(/\s*<!--BUYRIGHT:[\s\S]*?-->\s*/g, '').trim();
}

// ── DOM helpers ──
function appendMsg(role, text) {
  const el = document.createElement('div');
  el.className = `message ${role}`;
  if (role === 'assistant') {
    el.innerHTML = `
      <div class="avatar">BR</div>
      <div class="msg-body">
        <div class="bubble">${renderMd(text)}</div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="avatar">YOU</div>
      <div class="bubble">${escHtml(text)}</div>
    `;
  }
  messagesEl.appendChild(el);
  scrollDown();
  return el;
}

function appendTyping() {
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.innerHTML = `<div class="avatar">BR</div><div class="msg-body"><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  messagesEl.appendChild(el);
  scrollDown();
  return el;
}

function scrollDown() { messagesEl.scrollTop = messagesEl.scrollHeight; }

// ── Markdown renderer ──
function renderMd(text) {
  if (!text) return '';
  const linkPlaceholders = [];
  const withPlaceholders = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
    const i = linkPlaceholders.length;
    linkPlaceholders.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-link">${escHtml(label)}</a>`);
    return `\x00LINK${i}\x00`;
  });

  let html = escHtml(withPlaceholders)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/^#{1,3} (.+)$/gm, '<strong style="font-size:14px;display:block;margin:10px 0 4px">$1</strong>')
    .replace(/^[-›•] (.+)$/gm,  '<span style="display:block;padding-left:14px;margin:3px 0;color:var(--text-sec)">&#8250; $1</span>')
    .replace(/^\d+\. (.+)$/gm,  (_, p) => `<span style="display:block;padding-left:14px;margin:3px 0;color:var(--text-sec)">&#8250; ${p}</span>`)
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g,   '<br>');

  linkPlaceholders.forEach((link, i) => { html = html.replace(`\x00LINK${i}\x00`, link); });
  return html;
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Follow-up chips ──
function findFollowUpStart(text) {
  const divider = text.lastIndexOf('\n---');
  if (divider !== -1 && /Where do you want to go next\?/i.test(text)) return divider;
  const idx = text.search(/\n?Where do you want to go next\?/i);
  return idx !== -1 ? idx : -1;
}

function extractFollowUps(text) {
  const match = text.match(/Where do you want to go next\?[\s\S]*/i);
  if (!match) return [];
  const lines = [...match[0].matchAll(/^[-›•\*>]\s+(.+)$/gm)].map(m => m[1].trim());
  return lines.filter(l => l.length > 4 && l.length < 200).slice(0, 3);
}

function buildChips(chips) {
  const wrap = document.createElement('div');
  wrap.className = 'followup-chips';
  chips.forEach(chipText => {
    const btn = document.createElement('button');
    btn.className   = 'followup-chip';
    btn.textContent = chipText;
    btn.addEventListener('click', () => { if (!streaming) submitMessage(chipText); });
    wrap.appendChild(btn);
  });
  return wrap;
}

function buildFeedback(data, messageText) {
  const wrap = document.createElement('div');
  wrap.className = 'feedback-row';

  const label = document.createElement('span');
  label.className = 'feedback-label';
  label.textContent = 'Was this helpful?';

  const thumbUp = document.createElement('button');
  thumbUp.className = 'feedback-btn';
  thumbUp.textContent = 'Yes';
  thumbUp.setAttribute('aria-label', 'Helpful');

  const thumbDown = document.createElement('button');
  thumbDown.className = 'feedback-btn';
  thumbDown.textContent = 'No';
  thumbDown.setAttribute('aria-label', 'Not helpful');

  function sendFeedback(helpful) {
    thumbUp.disabled   = true;
    thumbDown.disabled = true;
    wrap.innerHTML = '<span class="feedback-thanks">Thanks for the feedback.</span>';

    fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        helpful,
        product:          data?.product || '',
        verdict:          data?.verdict || '',
        message_preview:  messageText.slice(0, 120),
      }),
    }).catch(() => {});
  }

  thumbUp.addEventListener('click',   () => sendFeedback(true));
  thumbDown.addEventListener('click', () => sendFeedback(false));

  wrap.appendChild(label);
  wrap.appendChild(thumbUp);
  wrap.appendChild(thumbDown);
  return wrap;
}

// ── Reasoning chain toggle ──
function toggleRC() {
  const body    = document.getElementById('rc-body');
  const trigger = document.getElementById('rc-toggle');
  if (!body) return;
  const open = body.classList.toggle('hidden');
  trigger.setAttribute('aria-expanded', String(!open));
}
window.toggleRC = toggleRC;
