/**
 * Vercel Serverless Function: /api/posts?handle=HANDLE
 *
 * Busca posts de RSS feeds públicos para cada conta monitorada.
 * Roda no servidor (Node.js) — sem problemas de CORS.
 */

// Mapeamento de handle → URL RSS nativa funcionando
const NATIVE_RSS = {
  Swiss_Ramble:  'https://swissramble.substack.com/feed',
  CIES_Football: null,
  geglobo:       null,
  fbref:         null,
  sofascore:     null,
  StatsBombData: null,
  OptaJoe:       null,
  WhoScored:     null,
  The_Atlas_FC:  null,
  TifoFootball_: null,
}

// RSS temáticos por categoria (fontes alternativas quando não há RSS direto)
const THEMATIC_RSS = {
  br:         ['https://trivela.com.br/feed/', 'https://www.futebolinterior.com.br/feed'],
  dados:      [],
  viral:      [],
  rankings:   [],
  tatica:     [],
  financeiro: ['https://swissramble.substack.com/feed'],
  pesquisa:   [],
}

const ACCOUNT_CAT = {
  fbref: 'dados', sofascore: 'dados', StatsBombData: 'dados',
  OptaJoe: 'viral', WhoScored: 'rankings',
  The_Atlas_FC: 'tatica', Swiss_Ramble: 'financeiro',
  TifoFootball_: 'tatica', CIES_Football: 'pesquisa',
  geglobo: 'br',
}

// Demo posts when all sources fail
const DEMO = {
  fbref: [
    { text: '[DEMO] FBref: Erling Haaland lidera xG da Premier League com 1.34/90. Segundo colocado está 0.31 pontos abaixo. Dominância estatística absoluta.', date: 'Demo', link: 'https://fbref.com', images: [] },
    { text: '[DEMO] Rodada UCL: os 5 jogadores com maior xA (expected assists) da fase de grupos. Surpreendente: nenhum dos 5 joga em time top-4.', date: 'Demo', link: 'https://fbref.com', images: [] },
  ],
  sofascore: [
    { text: '[DEMO] Sofascore Rating desta semana: Os 3 jogadores com nota acima de 9.0 no Brasileirão. Dois deles atuam em times do G4?', date: 'Demo', link: 'https://sofascore.com', images: [] },
  ],
  OptaJoe: [
    { text: '[DEMO] 63 — Gols de Cristiano Ronaldo em eliminatórias de Copa do Mundo. Nenhum outro jogador na história chegou a 30.', date: 'Demo', link: 'https://x.com/OptaJoe', images: [] },
    { text: '[DEMO] Messi marcou em 78% das decisões de Copa que disputou. A média dos outros finalistas: 24%.', date: 'Demo', link: 'https://x.com/OptaJoe', images: [] },
  ],
  WhoScored: [
    { text: '[DEMO] WhoScored ranking da semana: Top 5 jogadores da Premier League por média de nota. Configure X_BEARER_TOKEN para dados reais.', date: 'Demo', link: 'https://whoscored.com', images: [] },
  ],
  geglobo: [
    { text: '[DEMO] Brasileirão: Confira os destaques da última rodada. Adicione X_BEARER_TOKEN para carregar notícias reais do GE.', date: 'Demo', link: 'https://ge.globo.com', images: [] },
  ],
}

/** Fetch an RSS feed and return parsed posts */
async function fetchRSS(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FutDash/1.0; +https://futdash.vercel.app)',
      'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
    // Vercel functions have a 10s timeout by default
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const xml = await res.text()
  return parseRSS(xml)
}

/** Minimal RSS/Atom XML parser (no external deps) */
function parseRSS(xml) {
  const posts = []
  // Support RSS <item> and Atom <entry>
  const itemRx = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi
  let m
  while ((m = itemRx.exec(xml)) !== null && posts.length < 25) {
    const block = m[1]
    const text   = (getTag(block, 'title') || getTag(block, 'summary') || getTag(block, 'description') || '').trim()
    const link   = getTag(block, 'link') || getLinkHref(block) || ''
    const date   = fmtDate(getTag(block, 'pubDate') || getTag(block, 'published') || getTag(block, 'updated') || '')
    const images = extractImages(block)
    const clean  = stripHtml(text)
    if (clean) posts.push({ text: clean.slice(0, 600), link, date, images })
  }
  return posts
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:]]>)?<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}
function getLinkHref(xml) {
  const m = xml.match(/<link[^>]+href=["']([^"']+)["']/i)
  return m ? m[1] : ''
}
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n').trim()
}
function extractImages(block) {
  const imgs = []
  const rx = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)[^\s"'<>]*/gi
  let m
  while ((m = rx.exec(block)) !== null && imgs.length < 2) imgs.push(m[0])
  return imgs
}
function fmtDate(ds) {
  try {
    const d = new Date(ds)
    if (isNaN(d)) return ''
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
           d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers — allow any origin (PWA / browser)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const handle = (req.query.handle || '').replace(/[^a-zA-Z0-9_]/g, '')
  if (!handle) return res.status(400).json({ ok: false, error: 'Missing handle' })

  // 1. Try native RSS
  const nativeUrl = NATIVE_RSS[handle]
  if (nativeUrl) {
    try {
      const posts = await fetchRSS(nativeUrl)
      if (posts.length) {
        return res.json({ ok: true, posts, source: nativeUrl, count: posts.length })
      }
    } catch (_) {}
  }

  // 2. Try X API Bearer Token (if configured as Vercel env var)
  const bearerToken = process.env.X_BEARER_TOKEN
  if (bearerToken) {
    try {
      const userRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${handle}`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      )
      if (userRes.ok) {
        const { data } = await userRes.json()
        if (data?.id) {
          const tweetsRes = await fetch(
            `https://api.twitter.com/2/users/${data.id}/tweets?max_results=20&tweet.fields=created_at,text`,
            { headers: { Authorization: `Bearer ${bearerToken}` } }
          )
          if (tweetsRes.ok) {
            const { data: tweets } = await tweetsRes.json()
            const posts = (tweets || []).map(t => ({
              text: t.text || '',
              link: `https://x.com/${handle}/status/${t.id}`,
              date: fmtDate(t.created_at || ''),
              images: [],
            }))
            if (posts.length) {
              return res.json({ ok: true, posts, source: 'X API v2', count: posts.length })
            }
          }
        }
      }
    } catch (_) {}
  }

  // 3. Thematic RSS fallback
  const cat = ACCOUNT_CAT[handle] || ''
  for (const rssUrl of (THEMATIC_RSS[cat] || [])) {
    try {
      const posts = await fetchRSS(rssUrl)
      if (posts.length) {
        return res.json({ ok: true, posts, source: rssUrl, count: posts.length })
      }
    } catch (_) {}
  }

  // 4. Demo fallback
  const demoPosts = DEMO[handle] || [{
    text: `[DEMO] Conta @${handle} não tem RSS público disponível.\n\nPara posts reais: adicione X_BEARER_TOKEN nas variáveis de ambiente da Vercel.\n\nEnquanto isso, use estes posts de demonstração para explorar o app.`,
    date: 'Demo', link: `https://x.com/${handle}`, images: [],
  }]

  return res.json({ ok: true, posts: demoPosts, source: 'demo', count: demoPosts.length, demo: true })
}
