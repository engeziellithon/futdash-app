import { ACCOUNTS, CATS } from './accounts.js'

// ── STATE ──────────────────────────────────────────────
let curAcc  = null
let curPost = null
let curFmt  = 'viral'
let posts   = []
let arTimer = null
let settings = { apiKey: '', autoRefresh: 0, serverUrl: '', localModel: '' }
let customHandles = []  // handles personalizados do usuário

// ── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings()
  loadCustomHandles()
  buildSidebar()
  buildMobGrid()
  registerSW()

  // Close modal on backdrop click
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id === 'modal') closeSettings()
  })
})

// ── SERVICE WORKER ─────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
}

// ── SETTINGS ───────────────────────────────────────────
function loadSettings() {
  try {
    settings.apiKey      = localStorage.getItem('fd_key') || ''
    settings.autoRefresh = parseInt(localStorage.getItem('fd_ar') || '0')
    settings.serverUrl   = localStorage.getItem('fd_srv') || ''
    settings.localModel  = localStorage.getItem('fd_mdl') || ''
  } catch (_) {}
}

window.openSettings = () => {
  document.getElementById('apiInput').value = settings.apiKey
  document.getElementById('arSel').value    = settings.autoRefresh
  document.getElementById('srvInput').value = settings.serverUrl
  document.getElementById('mdlInput').value = settings.localModel
  toggleSrvFields()
  document.getElementById('modal').classList.add('open')
}
window.closeSettings = () => {
  document.getElementById('modal').classList.remove('open')
}
window.saveSettings = () => {
  settings.apiKey      = document.getElementById('apiInput').value.trim()
  settings.autoRefresh = parseInt(document.getElementById('arSel').value)
  settings.serverUrl   = document.getElementById('srvInput').value.trim().replace(/\/$/, '')
  settings.localModel  = document.getElementById('mdlInput').value.trim()
  try {
    localStorage.setItem('fd_key', settings.apiKey)
    localStorage.setItem('fd_ar',  settings.autoRefresh)
    localStorage.setItem('fd_srv', settings.serverUrl)
    localStorage.setItem('fd_mdl', settings.localModel)
  } catch (_) {}
  setupAR()
  closeSettings()
  const mode = settings.serverUrl ? `🖥️ LM Studio (${settings.serverUrl})` : '☁️ Grok (Vercel)'
  toast(`✅ Salvo — modo: ${mode}`, 'ok')
}

// Mostra/oculta campos de servidor local
window.toggleSrvFields = () => {
  const hasSrv = document.getElementById('srvInput').value.trim() !== ''
  const row = document.getElementById('mdlRow')
  if (row) row.style.display = hasSrv ? 'block' : 'none'
}

function setupAR() {
  if (arTimer) clearInterval(arTimer)
  if (settings.autoRefresh > 0 && curAcc)
    arTimer = setInterval(() => loadAcc(curAcc, false), settings.autoRefresh * 1000)
}

// ── CUSTOM HANDLES ────────────────────────────────────────
function loadCustomHandles() {
  try {
    const raw = localStorage.getItem('fd_custom')
    customHandles = raw ? JSON.parse(raw) : []
  } catch (_) { customHandles = [] }
  renderCustom()
}

function saveCustomHandles() {
  try { localStorage.setItem('fd_custom', JSON.stringify(customHandles)) } catch (_) {}
}

function parseHandles(raw) {
  return raw
    .split(/[,\n;]+/)
    .map(h => h.trim().replace(/^@/, '').replace(/[^\w.]/g, ''))
    .filter(h => h.length > 0 && h.length <= 50)
}

window.addCustomHandles = () => {
  const sbEl  = document.getElementById('sbHandleIn')
  const mobEl = document.getElementById('mobHandleIn')
  const raw   = (sbEl?.value || '') + ',' + (mobEl?.value || '')
  const news  = parseHandles(raw).filter(h => !customHandles.includes(h))
  if (!news.length) { toast('Nenhum handle novo válido', ''); return }
  customHandles = [...customHandles, ...news]
  saveCustomHandles()
  if (sbEl)  sbEl.value  = ''
  if (mobEl) mobEl.value = ''
  renderCustom()
  toast(`✅ Adicionado: ${news.map(h => '@'+h).join(', ')}`, 'ok')
  // Carrega automaticamente o primeiro novo
  if (news.length === 1) loadAcc(news[0])
}

window.removeCustomHandle = (handle, e) => {
  e.stopPropagation()
  customHandles = customHandles.filter(h => h !== handle)
  saveCustomHandles()
  renderCustom()
  if (curAcc === handle) {
    curAcc = null
    document.getElementById('feedBody').innerHTML =
      `<div class="empty"><div class="empty-ico">🗑️</div><div class="empty-ttl">Perfil removido</div></div>`
  }
  toast(`🗑️ @${handle} removido`, '')
}

// Renderiza a seção de custom accounts na sidebar + mobile grid
function renderCustom() {
  // Sidebar
  const existing = document.getElementById('custom-section-sb')
  if (existing) existing.remove()
  if (customHandles.length > 0) {
    const div = document.createElement('div')
    div.id = 'custom-section-sb'
    div.innerHTML = `<div class="cat-lbl" style="color:var(--blue)">📌 Meus Perfis</div>` +
      customHandles.map(h => `
        <div class="acc-row" id="si-${h}" onclick="loadAcc('${h}')">
          <div class="acc-ico" style="background:#4fc3f71a;font-size:13px">👤</div>
          <div><div class="acc-nm">@${h}</div><div class="acc-ds">Perfil customizado</div></div>
          <button class="acc-del" onclick="removeCustomHandle('${h}',event)" title="Remover">✕</button>
        </div>`).join('')
    document.getElementById('accList').appendChild(div)
  }

  // Mobile grid — custom cards section
  const existMob = document.getElementById('custom-section-mob')
  if (existMob) existMob.remove()
  if (customHandles.length > 0) {
    const grid = document.getElementById('mobGrid')
    const wrap = document.createElement('div')
    wrap.id = 'custom-section-mob'
    wrap.style.cssText = 'grid-column:1/-1'
    wrap.innerHTML = `<div class="mob-custom-ttl">📌 Meus Perfis</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px">` +
      customHandles.map(h => `
        <div class="mob-card${curAcc===h?' active':''}" id="mi-${h}"
             onclick="loadAcc('${h}');switchTab('feed')" style="position:relative">
          <button style="position:absolute;top:6px;right:6px;background:transparent;border:none;color:var(--text3);font-size:12px;cursor:pointer;padding:2px" onclick="removeCustomHandle('${h}',event)">✕</button>
          <div class="mob-card-ico">👤</div>
          <div class="mob-card-nm">@${h}</div>
          <div class="mob-card-ds">X</div>
        </div>`).join('') + '</div>'
    grid.parentElement.insertBefore(wrap, grid)
  }
}

// ── SIDEBAR ─────────────────────────────────────────────
function buildSidebar() {
  const grouped = {}
  ACCOUNTS.forEach(a => { ;(grouped[a.cat] = grouped[a.cat] || []).push(a) })
  let html = ''
  for (const [cat, list] of Object.entries(grouped)) {
    html += `<div class="cat-lbl">${CATS[cat] || cat}</div>`
    list.forEach(a => {
      html += `<div class="acc-row" id="si-${a.h}" onclick="loadAcc('${a.h}')">
        <div class="acc-ico" style="background:${a.clr}1a">${a.icon}</div>
        <div><div class="acc-nm">${a.n}</div><div class="acc-ds">${a.desc}</div></div>
        <div class="acc-live" style="background:${a.clr}1a;color:${a.clr}">LIVE</div>
      </div>`
    })
  }
  document.getElementById('accList').innerHTML = html
}

// ── MOBILE GRID ─────────────────────────────────────────
function buildMobGrid(filter = '') {
  const f = filter.toLowerCase()
  const visible = ACCOUNTS.filter(a =>
    !f || a.n.toLowerCase().includes(f) || a.h.toLowerCase().includes(f) || a.desc.toLowerCase().includes(f)
  )
  const html = visible.map(a => `
    <div class="mob-card${curAcc===a.h ? ' active' : ''}" id="mi-${a.h}"
         onclick="loadAcc('${a.h}');switchTab('feed')">
      <div class="mob-card-ico">${a.icon}</div>
      <div class="mob-card-nm">${a.n}</div>
      <div class="mob-card-ds">${a.desc}</div>
    </div>`).join('')
  document.getElementById('mobGrid').innerHTML = html || `<div style="color:var(--text2);padding:16px;grid-column:1/-1">Nenhum resultado</div>`
}

window.filterAccounts = (v) => buildMobGrid(v)

// ── MOBILE TABS ─────────────────────────────────────────
window.switchTab = (tab) => {
  document.querySelectorAll('.bnav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab)
  )
  const mobAcc = document.getElementById('mobAcc')
  if (tab === 'contas') {
    mobAcc.classList.add('open')
    closeMobAI()
  } else if (tab === 'ia') {
    mobAcc.classList.remove('open')
    if (curPost) openMobAI()
    else { switchTab('feed'); toast('Selecione um post primeiro ☝️', '') }
  } else {
    mobAcc.classList.remove('open')
    closeMobAI()
  }
}

// ── LOAD ACCOUNT ────────────────────────────────────────
window.loadAcc = async (handle, doSkel = true) => {
  curAcc = handle
  const acc = ACCOUNTS.find(a => a.h === handle)
  closeAI(); closeMobAI()

  // Active states
  document.querySelectorAll('.acc-row, .mob-card').forEach(e => e.classList.remove('active'))
  ;[document.getElementById(`si-${handle}`), document.getElementById(`mi-${handle}`)].forEach(e => {
    if (e) e.classList.add('active')
  })

  // Header
  document.getElementById('hAcc').textContent = acc ? `${acc.icon} ${acc.n}` : handle
  document.getElementById('hSub').textContent = `@${handle}`
  document.getElementById('fIcon').textContent  = acc?.icon || '📡'
  document.getElementById('fTitle').textContent = acc?.n    || handle
  document.getElementById('fTitle').style.color = acc?.clr  || 'var(--text1)'
  document.getElementById('fSub').textContent   = `@${handle} · carregando...`
  document.getElementById('fStatus').textContent = '⟳ buscando...'

  if (doSkel) showSkels()

  try {
    const res  = await fetch(`/api/posts?handle=${handle}`)
    const data = await res.json()

    if (data.ok && data.posts.length) {
      posts = data.posts
      renderPosts(data.posts, acc, handle)
      document.getElementById('fSub').textContent = `@${handle} · ${data.posts.length} posts · ${data.source || ''}`
      document.getElementById('fStatus').textContent = data.demo ? '⚠️ demo' : '✓ carregado'
      document.getElementById('fStatus').style.color = data.demo ? 'var(--yellow)' : 'var(--green)'
    } else {
      showErr(data.error || 'Falha ao carregar', handle)
      document.getElementById('fStatus').textContent = '❌ erro'
      document.getElementById('fStatus').style.color = 'var(--red)'
    }
  } catch (e) {
    showErr('Erro de rede.', handle)
    document.getElementById('fStatus').textContent = '❌ erro'
    document.getElementById('fStatus').style.color = 'var(--red)'
  }
  setupAR()
}

window.refresh = () => {
  if (!curAcc) { toast('Selecione uma conta primeiro', ''); return }
  const btn = document.getElementById('refreshBtn')
  btn.style.animation = 'sp .7s linear infinite'
  loadAcc(curAcc, false).finally(() => { btn.style.animation = '' })
}

// ── RENDER POSTS ─────────────────────────────────────────
function renderPosts(postList, acc, handle) {
  if (!postList.length) {
    document.getElementById('feedBody').innerHTML =
      `<div class="empty"><div class="empty-ico">🕳️</div>
       <div class="empty-ttl">Sem posts</div>
       <div class="empty-sub">Tente atualizar ou verifique @${handle}.</div></div>`
    return
  }

  const demoNote = postList.some(p => p.date === 'Demo') ? `
    <div class="demo-banner">
      ⚠️ <strong>Modo Demo</strong> — Posts de exemplo. Para dados reais, configure o X Bearer Token
      nas variáveis de ambiente da Vercel ou aguarde fontes RSS disponíveis.
    </div>` : ''

  const cards = postList.map((p, i) => {
    const clr  = acc?.clr  || '#00d4aa'
    const icon = acc?.icon || '📡'
    const name = acc?.n    || handle
    const imgs = (p.images || []).map(u =>
      `<img class="card-img" src="${u}" loading="lazy" onerror="this.parentElement.remove()">`
    ).join('')
    return `
      <div class="post-card" id="pc-${i}" onclick="selPost(${i},'${handle}')">
        <div class="card-top">
          <div class="card-author">
            <div class="card-av" style="background:${clr}20">${icon}</div>
            <div><div class="card-nm" style="color:${clr}">${name}</div>
                 <div class="card-hn">@${handle}</div></div>
          </div>
          <div class="card-dt">${p.date || ''}</div>
        </div>
        <div class="card-txt">${esc(p.text)}</div>
        ${imgs ? `<div class="card-imgs">${imgs}</div>` : ''}
        <div class="card-foot">
          ${p.link ? `<a class="card-link" href="${p.link}" target="_blank" rel="noopener">🔗 Ver original</a>` : ''}
          <span class="card-hint" style="color:${clr}88">✨ Reescrever →</span>
        </div>
      </div>`
  }).join('')

  document.getElementById('feedBody').innerHTML = demoNote + cards
}

function showSkels() {
  document.getElementById('feedBody').innerHTML = Array(5).fill(`
    <div class="skel"><div class="sk h"></div>
    <div class="sk l"></div><div class="sk m"></div>
    <div class="sk l"></div><div class="sk s"></div></div>`).join('')
}

function showErr(msg, handle) {
  document.getElementById('feedBody').innerHTML = `
    <div class="err-box"><div class="err-ttl">❌ Erro ao carregar @${handle}</div>
    <div class="err-sub">${msg}</div></div>
    <div style="text-align:center;padding:16px">
      <button class="btn btn-primary" onclick="loadAcc('${handle}')">🔄 Tentar novamente</button>
    </div>`
}

// ── SELECT POST ──────────────────────────────────────────
window.selPost = (i, handle) => {
  document.querySelectorAll('.post-card').forEach((e, j) => e.classList.toggle('sel', j === i))
  curPost = posts[i] || null
  if (!curPost) return
  window._aiHandle = handle

  renderAIContent()
  document.getElementById('iaBadge').classList.add('on')

  if (window.innerWidth < 768) openMobAI()
  else document.getElementById('aiPanelDesk').classList.add('open')
}

// ── AI CONTENT ───────────────────────────────────────────
function renderAIContent() {
  const html = `
    <div class="ai-box">
      <div class="ai-lbl">Post original</div>
      <div class="ai-orig">${curPost ? esc(curPost.text) : '—'}</div>
    </div>

    <div>
      <div class="ai-lbl" style="padding-bottom:6px">Formato de reescrita</div>
      <div class="fmt-grid">
        ${['viral','thread','comparacao','pergunta','polemico'].map((f,i) => {
          const info = {
            viral:     ['🔥','Viral','280 chars'],
            thread:    ['🧵','Thread','8 tweets'],
            comparacao:['⚖️','Comparação','visual'],
            pergunta:  ['❓','Enquete','debate'],
            polemico:  ['💥','Polêmico','dados+opinião'],
          }[f]
          return `<div class="fmt-btn${f===curFmt?' sel':''}${i===4?' fmt-full':''}" data-fmt="${f}" onclick="selFmt(this)">
            <div class="fmt-ico">${info[0]}</div>
            <div class="fmt-nm">${info[1]}</div>
            <div class="fmt-ds">${info[2]}</div>
          </div>`
        }).join('')}
      </div>
    </div>

    <div class="ai-acts">
      <button class="btn btn-primary" style="flex:1;min-height:44px" onclick="doRewrite()">✨ Reescrever</button>
      <button class="btn" style="min-height:44px" title="Copiar prompt" onclick="copyPrompt()">📋 Prompt</button>
    </div>

    <div class="ai-loader" id="aiLoader">
      <div class="spinner"></div>
      <span class="loader-txt" id="loaderTxt">Processando...</span>
    </div>

    <div class="ai-res" id="aiRes">
      <div class="ai-lbl">Resultado</div>
      <div class="res-txt" id="resTxt"></div>
      <div class="res-foot">
        <span class="char-ct" id="charCt">0 chars</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="doRewrite()">🔄</button>
          <button class="btn btn-primary btn-sm" onclick="copyResult()">📋 Copiar</button>
        </div>
      </div>
    </div>`

  document.getElementById('aiBDesk').innerHTML = html
  document.getElementById('aiBMob').innerHTML  = html
}

window.closeAI = () => {
  document.getElementById('aiPanelDesk').classList.remove('open')
  document.querySelectorAll('.post-card').forEach(e => e.classList.remove('sel'))
  document.getElementById('iaBadge').classList.remove('on')
  curPost = null
}
function openMobAI()  { document.getElementById('mobAI').classList.add('open') }
function closeMobAI() { document.getElementById('mobAI').classList.remove('open') }
window.closeMobAI = closeMobAI

window.selFmt = (el) => {
  curFmt = el.dataset.fmt
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.toggle('sel', b.dataset.fmt === curFmt))
  const r = document.getElementById('aiRes')
  if (r) r.classList.remove('on')
}

// ── PROMPTS (usados tanto no Vercel quanto no LM Studio local) ──
function buildPrompt(format, content, handle) {
  const P = {
    viral: `Você é um criador de conteúdo viral de futebol no X em português brasileiro. Tom: analítico, provocativo.\n\nTransforme em TWEET VIRAL com NO MÁXIMO 280 caracteres. Comece com número impactante. Máx 2 emojis. Inclua "Via @${handle}". Responda APENAS com o tweet.\n\nPost:\n${content}`,
    thread: `Você é um criador de threads virais de futebol no X em português brasileiro.\n\nThread de 8 tweets (1/ a 8/). 1/: gancho. 2/-6/: dados. 7/: revelação. 8/: pergunta + "RT se te surpreendeu". Cite "@${handle}" no tweet 2. Máx 280 chars cada. Responda APENAS com os tweets numerados.\n\nPost:\n${content}`,
    comparacao: `Você é especialista em comparações de futebol no X em português brasileiro.\n\nComparação visual em texto (máx 280 chars):\n  NOME A vs NOME B\n  ─────────────────\n  Métrica: X | Y\nConclua com pergunta. "Via @${handle}". Responda APENAS com o post.\n\nPost:\n${content}`,
    pergunta: `Você é especialista em engajamento de futebol no X em português brasileiro.\n\nEnquete viral (máx 280 chars): [dado impactante]\n\nQual sua opinião?\n[A] [B] [C]\n\nVia @${handle}\n\nResponda APENAS com o post.\n\nPost:\n${content}`,
    polemico: `Você é criador de conteúdo polêmico baseado em dados no X em português brasileiro.\n\nPost polêmico (máx 500 chars):\nOpinião impopular (com dados) 📊\n• [dado 1]\n• [dado 2]\n• [dado 3]\n[Conclusão ousada]\nVia @${handle}\n\nResponda APENAS com o post.\n\nPost:\n${content}`,
  }
  return P[format] || P.viral
}

// ── REWRITE ──────────────────────────────────────────────
window.doRewrite = async () => {
  if (!curPost) { toast('Nenhum post selecionado', ''); return }

  const handle  = window._aiHandle || 'fonte'
  const isLocal = !!settings.serverUrl

  // Validações por modo
  if (!isLocal && !settings.apiKey) {
    openSettings()
    toast('Configure sua chave Grok ⚙️', 'err')
    return
  }

  const loader  = document.getElementById('aiLoader')
  const result  = document.getElementById('aiRes')
  const loaderT = document.getElementById('loaderTxt')
  if (loader)  loader.classList.add('on')
  if (result)  result.classList.remove('on')
  if (loaderT) loaderT.textContent = isLocal ? '🖥️ Processando no LM Studio...' : '☁️ Processando com Grok...'

  try {
    let text

    if (isLocal) {
      // ── MODO LOCAL: chama LM Studio/Ollama/etc. direto do browser ──
      const endpoint = `${settings.serverUrl}/v1/chat/completions`
      const model    = settings.localModel || 'local-model'
      const prompt   = buildPrompt(curFmt, curPost.text, handle)

      const r = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens:  1024,
          temperature: 0.8,
          // Desativa modo thinking/reasoning se o modelo suportar
          ...(model.includes('qwen') || model.includes('gpt-oss') ? { thinking: { type: 'disabled' } } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!r.ok) {
        const err = await r.text()
        throw new Error(`LM Studio respondeu HTTP ${r.status}: ${err.slice(0, 200)}`)
      }
      const d = await r.json()
      const msg = d.choices?.[0]?.message || {}
      // Alguns modelos (thinking/reasoning) retornam content vazio e texto em 'reasoning'
      text = (msg.content || msg.reasoning || '').trim()
      if (!text) throw new Error('Resposta vazia do modelo local')

    } else {
      // ── MODO NUVEM: chama /api/rewrite na Vercel (Grok) ──
      const r = await fetch('/api/rewrite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: settings.apiKey,
          content: curPost.text,
          format:  curFmt,
          handle,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || 'Erro na API Grok')
      text = d.result
    }

    if (loader) loader.classList.remove('on')
    const rtxt = document.getElementById('resTxt')
    const cc   = document.getElementById('charCt')
    if (rtxt) rtxt.textContent = text
    if (cc) {
      cc.textContent = `${text.length} chars`
      cc.className   = `char-ct${text.length > 280 ? ' over' : ''}`
    }
    if (result) result.classList.add('on')

  } catch (e) {
    if (loader) loader.classList.remove('on')
    const isLocalErr = isLocal && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))
    if (isLocalErr) {
      toast('❌ LM Studio inacessível. Verifique se está rodando e se o CORS está ativado.', 'err')
    } else {
      toast(`❌ ${e.message}`, 'err')
    }
  }
}

window.copyResult = () => {
  const el = document.getElementById('resTxt')
  if (el) { clip(el.textContent); toast('📋 Copiado!', 'ok') }
}

window.copyPrompt = () => {
  if (!curPost) { toast('Selecione um post primeiro', ''); return }
  const h = window._aiHandle || 'fonte'
  const prompts = {
    viral:     `Tweet viral (máx 280 chars) em português BR. Comece com número impactante. Inclua "Via @${h}".\n\n${curPost.text}`,
    thread:    `Thread 8 tweets (1/ a 8/) em português BR. Gancho no 1/, dados no meio, pergunta no 8/. Cite "@${h}".\n\n${curPost.text}`,
    comparacao:`Comparação visual em texto (máx 280 chars) PT-BR. Inclua "Via @${h}".\n\n${curPost.text}`,
    pergunta:  `Enquete múltipla escolha (máx 280 chars) PT-BR. Opções A/B/C. Inclua "Via @${h}".\n\n${curPost.text}`,
    polemico:  `"Opinião impopular (com dados) 📊" + 3 bullet points com dados. Inclua "Via @${h}".\n\n${curPost.text}`,
  }
  clip(prompts[curFmt] || prompts.viral)
  toast('📋 Prompt copiado! Cole no Claude.ai', 'ok')
}

// ── UTILS ─────────────────────────────────────────────────
function esc(t) {
  return String(t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function clip(txt) {
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => fbClip(txt))
  else fbClip(txt)
}
function fbClip(txt) {
  const ta = Object.assign(document.createElement('textarea'),
    { value: txt, style: 'position:fixed;opacity:0' })
  document.body.appendChild(ta); ta.select()
  document.execCommand('copy'); ta.remove()
}
function toast(msg, type = '') {
  const c  = document.getElementById('toasts')
  const el = document.createElement('div')
  el.className = `toast ${type}`; el.innerHTML = msg
  c.appendChild(el)
  setTimeout(() => {
    el.style.cssText = 'opacity:0;transform:translateY(8px);transition:all .3s'
    setTimeout(() => el.remove(), 300)
  }, 3000)
}
