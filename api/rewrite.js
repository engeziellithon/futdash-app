/**
 * Vercel Serverless Function: POST /api/rewrite
 *
 * Chama a API Claude para reescrever um post de futebol
 * em diferentes formatos otimizados para o X (Twitter).
 *
 * A chave Claude é passada pelo cliente (armazenada no localStorage do browser)
 * ou pode ser configurada como variável de ambiente na Vercel (ANTHROPIC_API_KEY).
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ ok: false, error: 'Method not allowed' })

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  } catch (_) {}

  const apiKey  = (body.api_key || process.env.ANTHROPIC_API_KEY || '').trim()
  const content = (body.content || '').trim()
  const format  = body.format  || 'viral'
  const handle  = body.handle  || 'fonte'

  if (!apiKey)  return res.json({ ok: false, error: 'Chave de API não configurada.' })
  if (!content) return res.json({ ok: false, error: 'Conteúdo vazio.' })

  const PROMPTS = {
    viral: `Você é um criador de conteúdo viral de futebol no X em português brasileiro.
Tom: analítico, provocativo, linguagem de torcedor inteligente.

Transforme o post abaixo em um TWEET VIRAL com NO MÁXIMO 280 caracteres.
- Comece com um número ou afirmação surpreendente
- Use no máximo 2 emojis estratégicos
- Inclua "Via @${handle}" no final
- Responda APENAS com o tweet. Nada mais.

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
- Responda APENAS com os tweets numerados.

Post original:
${content}`,

    comparacao: `Você é um criador de posts de comparação de futebol no X em português brasileiro.

Transforme em COMPARAÇÃO VISUAL (máx 280 chars):
  NOME A vs NOME B
  ─────────────────
  Métrica1: X | Y
  Métrica2: X | Y

- Termine com conclusão ou pergunta
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

Responda APENAS com o post.

Post original:
${content}`,

    polemico: `Você é um criador de conteúdo polêmico baseado em dados no X em português brasileiro.

Transforme em POST POLÊMICO (máx 500 chars):
Opinião impopular (com dados) 📊

• [dado 1 mais surpreendente]
• [dado 2 que contradiz a narrativa]
• [dado 3 definitivo]

[Conclusão ousada em 1 frase]

Via @${handle}

Responda APENAS com o post.

Post original:
${content}`,
  }

  const prompt = PROMPTS[format] || PROMPTS.viral

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data = await claudeRes.json()

    if (claudeRes.ok && data.content) {
      return res.json({ ok: true, result: data.content[0].text.trim() })
    }

    const errMsg = data.error?.message || `HTTP ${claudeRes.status}`
    return res.json({ ok: false, error: `Erro Claude: ${errMsg}` })

  } catch (e) {
    return res.json({ ok: false, error: `Erro de rede: ${e.message}` })
  }
}
