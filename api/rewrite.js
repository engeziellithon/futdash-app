/**
 * Vercel Serverless Function: POST /api/rewrite
 *
 * Chama a API do Grok (xAI) para reescrever posts de futebol.
 * A API do Grok é compatível com OpenAI — endpoint /v1/chat/completions.
 *
 * Obtenha sua chave grátis em: https://console.x.ai/
 * Limites free tier: muito generosos (ideal para uso pessoal).
 */

const XAI_BASE   = 'https://api.x.ai/v1/chat/completions'
const XAI_MODEL  = process.env.GROK_MODEL || 'grok-3-mini'   // ou 'grok-3'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ ok: false, error: 'Method not allowed' })

  let body = {}
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}) }
  catch (_) {}

  // Chave pode vir do browser (localStorage) ou das env vars da Vercel
  const apiKey  = (body.api_key || process.env.GROK_API_KEY || '').trim()
  const content = (body.content || '').trim()
  const format  = body.format  || 'viral'
  const handle  = body.handle  || 'fonte'

  if (!apiKey)  return res.json({ ok: false, error: 'Chave Grok não configurada. Acesse ⚙️ Configurações.' })
  if (!content) return res.json({ ok: false, error: 'Conteúdo vazio.' })

  const PROMPTS = {
    viral: `Você é um criador de conteúdo viral de futebol no X em português brasileiro.
Tom: analítico, provocativo, linguagem de torcedor inteligente.

Transforme o post abaixo em um TWEET VIRAL com NO MÁXIMO 280 caracteres.
- Comece com um número ou afirmação surpreendente
- Use no máximo 2 emojis estratégicos
- Inclua "Via @${handle}" no final
- Responda APENAS com o tweet, sem explicações.

Post original:
${content}`,

    thread: `Você é um criador de threads virais de futebol no X em português brasileiro.

Transforme em uma THREAD de 8 tweets numerados (1/ a 8/):
- 1/: Gancho impossível de ignorar
- 2/-6/: Dados, contexto e análise progressiva
- 7/: Comparação ou revelação inesperada
- 8/: Pergunta de engajamento + "RT se te surpreendeu"
- Cite "@${handle}" no tweet 2 ou 3
- Cada tweet: máx 280 chars
- Responda APENAS com os tweets numerados, sem mais nada.

Post original:
${content}`,

    comparacao: `Você é um criador de posts de comparação de futebol no X em português brasileiro.

Transforme em COMPARAÇÃO VISUAL em texto (máx 280 chars):
  NOME A vs NOME B
  ─────────────────
  Métrica 1: X | Y
  Métrica 2: X | Y

- Termine com conclusão ou pergunta curta
- "Via @${handle}"
- Responda APENAS com o post.

Post original:
${content}`,

    pergunta: `Você é um especialista em engajamento de futebol no X em português brasileiro.

Transforme em ENQUETE VIRAL (máx 280 chars):
[Dado impactante em 1 linha]

Qual sua opinião?
[A] Opção
[B] Opção
[C] Opção

Via @${handle}

Responda APENAS com o post, sem mais nada.

Post original:
${content}`,

    polemico: `Você é um criador de conteúdo polêmico baseado em dados no X em português brasileiro.

Transforme em POST POLÊMICO (máx 500 chars):
Opinião impopular (com dados) 📊

• [dado 1 surpreendente]
• [dado 2 que contradiz a narrativa popular]
• [dado 3 definitivo]

[Conclusão ousada em 1 frase]

Via @${handle}

Responda APENAS com o post.

Post original:
${content}`,
  }

  const prompt = PROMPTS[format] || PROMPTS.viral

  try {
    const grokRes = await fetch(XAI_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       XAI_MODEL,
        max_tokens:  1024,
        temperature: 0.8,
        messages: [
          {
            role:    'user',
            content: prompt,
          }
        ],
      }),
    })

    const data = await grokRes.json()

    if (grokRes.ok && data.choices?.[0]?.message?.content) {
      return res.json({ ok: true, result: data.choices[0].message.content.trim() })
    }

    // Tratar erros específicos da xAI
    const errMsg = data.error?.message || data.message || `HTTP ${grokRes.status}`
    return res.json({ ok: false, error: `Grok API: ${errMsg}` })

  } catch (e) {
    return res.json({ ok: false, error: `Erro de rede: ${e.message}` })
  }
}
