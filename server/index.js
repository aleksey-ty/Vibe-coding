// Минимальный Node.js backend для AI-анализа заявок.
// Без Express и сторонних зависимостей: встроенный http + fetch (Node 18+).
//
// Frontend (src/data/aiAnalysis.js) отправляет заявку на POST /api/analyze-lead,
// в dev-режиме запрос идёт через Vite-proxy. Backend обращается к OpenRouter,
// ключ читается из .env и никогда не попадает во frontend.
//
// Ответ endpoint'а всегда JSON:
//   успех   — { priority, reason, missingInformation, qualificationQuestions,
//               recommendedAction, salesStrategy }
//   ошибка  — { error: string }

import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Модель берётся из .env (OPENROUTER_MODEL). Значение по умолчанию — платная
// модель для контролируемого теста: бесплатные модели не используются, чтобы
// не упираться в free rate limit.
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash-0731'

// Один AI-запрос — 30 секунд. При таймауте повтор не делается (см. describeError).
const REQUEST_TIMEOUT_MS = 30000
const MAX_BODY_BYTES = 32 * 1024
const MAX_FIELD_TEXT = 1000
const PRIORITIES = ['hot', 'warm', 'cold']

// Стратегия обработки лида — стабильные значения контракта.
const STRATEGIES = ['qualification', 'direct_contact', 'urgent_contact', 'follow_up', 'low_priority']

// Ограничения на массивы в ответе AI (missingInformation/qualificationQuestions).
const MAX_LIST_ITEMS = 6
const MAX_LIST_ITEM_TEXT = 300

// Простейший in-memory rate limit для demo: без внешних зависимостей и без
// таймеров. Нужен, чтобы AI endpoint нельзя было вызывать бесконечно
// (расход токенов OpenRouter). Счётчики живут в процессе сервера.
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 20
const rateLimitHits = new Map()

// Простейший загрузчик .env: без зависимостей и без перезаписи уже заданных
// переменных окружения. Позволяет запускать `npm run server` без флагов.
function loadDotEnv() {
  const envPath = new URL('../.env', import.meta.url)
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0])) {
      value = value.slice(1, -1)
    }

    if (key && !process.env[key]) process.env[key] = value
  }
}

loadDotEnv()

function getApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || ''
}

function getModel() {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL
}

// Читаем лениво, чтобы значение из .env тоже учитывалось.
function getPort() {
  return Number(process.env.PORT) || 3001
}

// Промпт анализа. Модель не должна ничего додумывать: только факты заявки.
const SYSTEM_PROMPT = [
  'Ты — AI-аналитик входящих лидов малого и среднего бизнеса.',
  'Твоя задача — квалифицировать заявку и помочь менеджеру решить, что делать дальше.',
  'Анализируй ТОЛЬКО данные, которые реально переданы в заявке.',
  'КРИТИЧЕСКИ ВАЖНО: не подменяй контекст заявки. Отрасль, продукт, услуга, задача, бюджет и обстоятельства',
  'должны остаться ровно такими, как в заявке. Например, если в заявке сайт для автосервиса,',
  'в ответе не должно быть окон, балконов, монтажа, доставки или других услуг, которых в заявке нет.',
  'Не переноси знания и примеры из других заявок. Если информации нет — так и напиши, что она отсутствует.',
  'НЕЛЬЗЯ: искать информацию о компании самостоятельно; придумывать бюджет, сроки, размер бизнеса,',
  'наличие CRM, проблемы клиента; выдумывать любые сведения, которых нет в заявке;',
  'утверждать, что клиент готов купить, если это не следует из заявки;',
  'использовать телефон или другие контактные данные как основание для оценки качества лида;',
  'делать поиск в интернете; добавлять текст вне JSON.',
  'Телефон можно упомянуть только в recommendedAction, если менеджеру действительно нужно связаться с клиентом.',
  'Учитывай: конкретность запроса, выраженную потребность, коммерческое намерение,',
  'срочность (если она указана явно), стоимость и ценность заявки, полноту и качество данных,',
  'конкретный результат, который хочет получить клиент, наличие понятного следующего действия.',
  'Отличай утверждённый бюджет от предполагаемого: «бюджет утверждён» — сильный признак готовности,',
  'а «примерно», «планируем», «изучаем рынок», «сравниваем варианты» — слабый.',
  'priority — одно из значений:',
  'hot — есть утверждённый бюджет или явная готовность начать, конкретная задача с понятными требованиями',
  'и короткий срок, часто уже известно лицо, принимающее решение;',
  'warm — задача и коммерческий интерес есть, но бюджет не утверждён, сроки не определены',
  'или клиент сравнивает подрядчиков и заявку нужно дополнительно квалифицировать;',
  'cold — слабый коммерческий сигнал: конкретной задачи нет, есть только вопрос о цене,',
  'нет сроков, нет бюджета и нет явного намерения начинать.',
  'Важно: priority не определяется только по сумме — описание заявки обязательно учитывается.',
  'Сумма сама по себе не делает заявку hot.',
  'reason — объясни, какие именно признаки заявки повлияли на priority:',
  'потенциальная ценность, конкретика запроса, срочность, признаки готовности к покупке, полнота информации.',
  'Не пересказывай текст заявки и не выдумывай отсутствующие данные.',
  'Каждое утверждение в reason, missingInformation, qualificationQuestions и recommendedAction',
  'должно быть связано именно с этой заявкой и опираться на её текст.',
  'Примеры формулировок в этом промпте показывают только стиль. Не переноси их содержание,',
  'если оно не относится к текущей заявке: вопросы и рекомендации должны быть про эту заявку.',
  'missingInformation — массив строк: только действительно важная информация, которой не хватает для квалификации',
  '(например: бюджет, сроки, конкретные требования, текущий процесс, объём заявок, лицо, принимающее решение).',
  'Если информации достаточно — верни пустой массив [].',
  'Не включай в missingInformation то, что уже указано в заявке: если бюджет, сроки, лицо,',
  'принимающее решение, или конкретный функционал названы — считай эти данные известными',
  'и не спрашивай о них.',
  'qualificationQuestions — массив конкретных вопросов клиенту на основе missingInformation:',
  'практичные формулировки, пригодные для реального разговора менеджера.',
  'Нельзя использовать общие фразы вроде "Расскажите подробнее о проекте".',
  'Пример хорошего вопроса: "Сколько входящих заявок вы получаете в среднем за день?"',
  'Задавай только действительно необходимые вопросы: обычно 2–5, а для hot-лида — меньше.',
  'Если дополнительная квалификация не требуется — верни пустой массив [].',
  'recommendedAction — ОДНО конкретное следующее действие менеджера: что именно сделать при контакте.',
  'Нельзя писать просто "Связаться с клиентом".',
  'Пример: "Провести короткий квалификационный звонок и выяснить объём входящих заявок,',
  'текущий процесс обработки и желаемые сроки автоматизации."',
  'salesStrategy — одно значение из списка:',
  'qualification — сначала квалифицировать заявку;',
  'direct_contact — можно переходить к предметному контакту;',
  'urgent_contact — требуется максимально быстрый контакт;',
  'follow_up — требуется повторный контакт;',
  'low_priority — обработать после более перспективных заявок.',
  'salesStrategy должна соответствовать priority: для cold без явной срочности не выбирай urgent_contact,',
  'для hot обычно подходят urgent_contact или direct_contact.',
  'Ответь ТОЛЬКО JSON без пояснений и без markdown:',
  '{"priority":"hot","reason":"...","missingInformation":["..."],"qualificationQuestions":["..."],',
  '"recommendedAction":"...","salesStrategy":"qualification"}',
].join(' ')

// Structured output: если провайдер не поддерживает response_format, запрос
// повторяется один раз без него (см. requestAnalysis). Для остальных ошибок
// (429, 401, quota, timeout, 5xx) повтор не делается.
const ANALYSIS_JSON_SCHEMA = {
  name: 'lead_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'priority',
      'reason',
      'missingInformation',
      'qualificationQuestions',
      'recommendedAction',
      'salesStrategy',
    ],
    properties: {
      priority: { type: 'string', enum: PRIORITIES },
      reason: { type: 'string' },
      missingInformation: { type: 'array', items: { type: 'string' } },
      qualificationQuestions: { type: 'array', items: { type: 'string' } },
      recommendedAction: { type: 'string' },
      salesStrategy: { type: 'string', enum: STRATEGIES },
    },
  },
}

function buildUserPrompt(lead) {
  const lines = [
    `Имя клиента: ${lead.name}`,
    `Компания: ${lead.company || 'не указана'}`,
    `Источник: ${lead.source || 'не указан'}`,
    `Контакт: ${lead.contact || 'не указан'}`,
    `Потенциальная сумма: ${lead.value === null ? 'не указана' : `${lead.value} RUB`}`,
    `Текущий статус заявки: ${lead.status}`,
    `Внутренний приоритет по сумме: ${lead.heat || 'не определён'}`,
    `Описание заявки: ${lead.description}`,
  ]

  return `${lines.join('\n')}\n\nВерни только JSON-объект анализа, без текста до и после.`
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

// Виды сбоев OpenRouter: от них зависит HTTP-статус для frontend
// и разрешён ли fallback без structured output.
const UPSTREAM_KINDS = {
  rateLimit: 'rate_limit',
  auth: 'auth',
  invalidRequest: 'invalid_request',
  server: 'server',
  structuredOutput: 'structured_output',
  upstream: 'upstream',
}

// Ошибка на стороне OpenRouter (HTTP-статус, сбой авторизации, пустой ответ).
class UpstreamError extends Error {
  constructor(message, { status = null, kind = UPSTREAM_KINDS.upstream } = {}) {
    super(message)
    this.status = status
    this.kind = kind
  }
}

// 429 / quota / free-models-per-day и прочие признаки лимита запросов.
const RATE_LIMIT_PATTERN = /rate limit|rate-limit|too many requests|quota|free-models-per-day|credits|capacity/i

// Признаки того, что провайдер не поддерживает response_format/json_schema:
// только для этой ошибки разрешён fallback без structured output.
const STRUCTURED_OUTPUT_PATTERN = /response_format|response format|json_schema|json schema|structured output|structured_outputs/i

const AUTH_PATTERN = /api key|api-key|unauthor|authentication|invalid credentials|no auth/i

// Разделяем ошибки: frontend получает разный HTTP-статус, а лишние запросы
// к OpenRouter не делаются (см. requestAnalysis).
function classifyUpstreamError({ status, errorCode, errorMessage }) {
  const text = `${errorMessage ?? ''} ${errorCode ?? ''}`.toLowerCase()
  const codes = [status, errorCode].map((value) => Number(value)).filter(Number.isFinite)

  if (codes.includes(429) || RATE_LIMIT_PATTERN.test(text)) return UPSTREAM_KINDS.rateLimit
  if (codes.includes(401) || codes.includes(403) || AUTH_PATTERN.test(text)) return UPSTREAM_KINDS.auth
  if (STRUCTURED_OUTPUT_PATTERN.test(text)) return UPSTREAM_KINDS.structuredOutput
  if (codes.includes(400) || codes.includes(404) || codes.includes(422)) return UPSTREAM_KINDS.invalidRequest
  if (codes.some((code) => code >= 500)) return UPSTREAM_KINDS.server
  return UPSTREAM_KINDS.upstream
}

// Короткое сообщение провайдера: без простыней и переносов строк.
// Полный ответ OpenRouter и в логи, и наружу не попадает.
function shortUpstreamMessage(message) {
  const text = typeof message === 'string' ? message.replace(/\s+/g, ' ').trim() : ''
  return text ? `OpenRouter: ${text.slice(0, 200)}` : 'OpenRouter request failed'
}

// Короткий безопасный лог сбоя: без API key, тела запроса и полного ответа.
function logUpstreamFailure(kind, status) {
  if (kind === UPSTREAM_KINDS.rateLimit) {
    console.error('[analyze-lead] OpenRouter rate limit reached')
    return
  }
  if (kind === UPSTREAM_KINDS.auth) {
    console.error('[analyze-lead] OpenRouter authentication failed')
    return
  }

  console.error(`[analyze-lead] OpenRouter request failed (HTTP ${status ?? 'n/a'}, ${kind})`)
}

function asTrimmedString(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

// Массив строк: нестроковые и пустые элементы отбрасываются, размер и длина
// ограничены. Если AI вернул не массив — считаем, что список пуст.
function asStringList(value) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .slice(0, MAX_LIST_ITEMS)
    .map((item) => item.trim().slice(0, MAX_LIST_ITEM_TEXT))
}

// salesStrategy: приводим к стабильному токену (пробелы и дефисы → '_').
// Неизвестное значение не отбрасываем: UI покажет его как есть, а не сломается.
function normalizeStrategy(value) {
  const raw = asTrimmedString(value, 60)
  if (!raw) return ''

  const token = raw.toLowerCase().replace(/[\s-]+/g, '_')
  return STRATEGIES.includes(token) ? token : raw
}

// Во frontend уходят только поля, нужные для анализа; мусор и лишние поля
// отбрасываются, обязательные проверяются.
function sanitizeLead(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { lead: null, errors: ['Request body must be a JSON object'] }
  }

  const errors = []
  const name = asTrimmedString(body.name, 200)
  const description = asTrimmedString(body.description, 2000)

  if (!name) errors.push('"name" is required and must be a non-empty string')
  if (!description) errors.push('"description" is required and must be a non-empty string')
  if (errors.length > 0) return { lead: null, errors }

  let value = null
  if (body.value !== null && body.value !== undefined && body.value !== '') {
    const parsed = typeof body.value === 'number' ? body.value : Number(String(body.value).replace(',', '.'))
    if (Number.isFinite(parsed) && parsed >= 0) value = parsed
  }

  return {
    lead: {
      name,
      company: asTrimmedString(body.company, 200),
      source: asTrimmedString(body.source, 120),
      contact: asTrimmedString(body.contact, 200),
      description,
      value,
      status: asTrimmedString(body.status, 40) || 'new',
      heat: PRIORITIES.includes(body.heat) ? body.heat : null,
    },
    errors: [],
  }
}

// Достаём JSON даже если модель обернула его в markdown или добавила текст.
function extractJson(text) {
  const candidate = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) return null

    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

// Проверка и нормализация ответа модели: наружу уходит только валидный объект.
function normalizeAnalysis(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const reason = asTrimmedString(payload.reason, MAX_FIELD_TEXT)
  const recommendedAction = asTrimmedString(payload.recommendedAction, MAX_FIELD_TEXT)
  const salesStrategy = normalizeStrategy(payload.salesStrategy)

  if (!PRIORITIES.includes(payload.priority)) return null
  if (!reason || !recommendedAction || !salesStrategy) return null

  return {
    priority: payload.priority,
    reason,
    missingInformation: asStringList(payload.missingInformation),
    qualificationQuestions: asStringList(payload.qualificationQuestions),
    recommendedAction,
    salesStrategy,
  }
}

async function requestOpenRouter({ apiKey, messages, useStructuredOutput }) {
  const payload = {
    model: getModel(),
    temperature: 0.2,
    // Полей стало больше (квалификация лида), поэтому лимит выше прежнего.
    max_tokens: 1000,
    reasoning: {
      enabled: false,
    },
    messages,
  }

  if (useStructuredOutput) {
    payload.response_format = { type: 'json_schema', json_schema: ANALYSIS_JSON_SCHEMA }
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'AI Lead Manager',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const raw = await response.text()

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    logUpstreamFailure(UPSTREAM_KINDS.upstream, response.status)
    throw new UpstreamError('OpenRouter returned a non-JSON response', { status: response.status })
  }

  if (!response.ok) {
    const errorMessage = data?.error?.message ?? null
    const errorCode = data?.error?.code ?? null
    const kind = classifyUpstreamError({ status: response.status, errorCode, errorMessage })

    // Безопасный короткий лог. Ответ OpenRouter целиком не логируется.
    logUpstreamFailure(kind, response.status)

    throw new UpstreamError(shortUpstreamMessage(errorMessage), { status: response.status, kind })
  }

  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    // Пустой completion: fallback и повторы не выполняются.
    throw new UpstreamError('AI returned an empty response', { status: response.status })
  }

  return content
}

// Сначала пробуем structured output, затем — обычный текстовый JSON.
async function requestAnalysis(lead, apiKey) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(lead) },
  ]

  try {
    return await requestOpenRouter({ apiKey, messages, useStructuredOutput: true })
  } catch (error) {
    // Fallback разрешён ТОЛЬКО если провайдер не поддержал structured output.
    // 429, 401, quota, timeout, network, 5xx и 400 — один запрос и сразу ошибка,
    // чтобы заявка не превращалась в лишние запросы и расход токенов.
    if (!(error instanceof UpstreamError) || error.kind !== UPSTREAM_KINDS.structuredOutput) throw error

    console.warn('[analyze-lead] response_format is not supported; retrying once without it')
    return requestOpenRouter({ apiKey, messages, useStructuredOutput: false })
  }
}

function describeError(error) {
  // Таймаут: повторный запрос не делается.
  if (error?.name === 'TimeoutError') {
    return { statusCode: 504, message: 'AI request timed out' }
  }

  // Сетевой сбой/иная неожиданная ошибка — без деталей upstream.
  if (!(error instanceof UpstreamError)) {
    return { statusCode: 502, message: 'AI service is unavailable' }
  }

  switch (error.kind) {
    case UPSTREAM_KINDS.rateLimit:
      return { statusCode: 429, message: 'AI rate limit reached' }
    case UPSTREAM_KINDS.auth:
      return { statusCode: 401, message: 'AI authentication failed' }
    case UPSTREAM_KINDS.invalidRequest:
      return { statusCode: 400, message: 'AI request is invalid' }
    case UPSTREAM_KINDS.server:
      return { statusCode: 502, message: 'AI provider error' }
    default:
      // Пустой ответ и невалидный анализ — короткое сообщение, без raw response.
      return { statusCode: 502, message: error.message }
  }
}

// IP клиента: за proxy (в том числе за Vite dev-сервером) учитываем X-Forwarded-For.
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()

  return req.socket?.remoteAddress ?? 'unknown'
}

// Ленивая очистка старых окон вместо setInterval: таймеров в сервере нет.
function checkRateLimit(ip, nowMs = Date.now()) {
  for (const [key, entry] of rateLimitHits) {
    if (entry.resetAt <= nowMs) rateLimitHits.delete(key)
  }

  const entry = rateLimitHits.get(ip)
  if (!entry) {
    rateLimitHits.set(ip, { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - nowMs) / 1000)),
    }
  }

  entry.count += 1
  return { allowed: true }
}

// Все ответы — только JSON: HTML-ошибок клиент не увидит.
function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders,
  })
  res.end(body)
}

function sendNoContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end()
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let settled = false
    let size = 0
    const chunks = []

    function fail(error) {
      if (settled) return
      settled = true
      reject(error)
    }

    req.on('data', (chunk) => {
      if (settled) return

      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        // Дальше тело не читаем, но соединение не рвём: иначе клиент
        // не получит JSON-ответ 413.
        fail(new HttpError(413, 'Request body is too large'))
        req.resume()
        return
      }

      chunks.push(chunk)
    })

    req.on('end', () => {
      if (settled) return
      settled = true

      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        reject(new HttpError(400, 'Request body is empty'))
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new HttpError(400, 'Request body must be valid JSON'))
      }
    })

    req.on('aborted', () => fail(new HttpError(400, 'Request was aborted')))
    req.on('error', () => fail(new HttpError(400, 'Failed to read request body')))
  })
}

async function handleAnalyzeLead(req, res) {
  const body = await readJsonBody(req)

  const { lead, errors } = sanitizeLead(body)
  if (errors.length > 0) {
    sendJson(res, 400, { error: 'Invalid lead payload', details: errors })
    return
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('[analyze-lead] OPENROUTER_API_KEY is not set')
    sendJson(res, 500, {
      error: 'OPENROUTER_API_KEY is not set on the server. Add it to .env (see .env.example).',
    })
    return
  }

  let content
  try {
    content = await requestAnalysis(lead, apiKey)
  } catch (error) {
    const { statusCode, message } = describeError(error)
    console.error(`[analyze-lead] ${message}`)
    sendJson(res, statusCode, { error: message })
    return
  }

  const analysis = normalizeAnalysis(extractJson(content))
  if (!analysis) {
    console.error('[analyze-lead] AI returned invalid analysis')
    sendJson(res, 502, { error: 'AI returned invalid analysis' })
    return
  }

  sendJson(res, 200, analysis)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (url.pathname !== '/api/analyze-lead') {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  if (req.method === 'OPTIONS') {
    sendNoContent(res)
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST' }, { Allow: 'POST' })
    return
  }

  const contentType = String(req.headers['content-type'] ?? '').toLowerCase()
  if (!contentType.includes('application/json')) {
    sendJson(res, 415, { error: 'Content-Type must be application/json' })
    return
  }

  // Ограничение частоты: защита от бесконечных вызовов AI с одного IP.
  const limit = checkRateLimit(getClientIp(req))
  if (!limit.allowed) {
    sendJson(
      res,
      429,
      { error: 'Too many requests. Try again later.' },
      { 'Retry-After': String(limit.retryAfterSeconds) },
    )
    return
  }

  handleAnalyzeLead(req, res).catch((error) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error?.message || 'Internal server error'
    console.error(`[analyze-lead] ${message}`)

    if (res.headersSent || res.writableEnded) return
    // Наружу не проходит внутренний текст ошибки: только общее сообщение.
    const publicMessage = error instanceof HttpError ? message : 'Internal server error'
    sendJson(res, statusCode, { error: publicMessage })
  })
})

server.listen(getPort(), () => {
  console.log(`[server] AI lead analysis API: http://localhost:${getPort()}/api/analyze-lead`)
  console.log(`[server] model: ${getModel()}`)
  console.log(`[server] OPENROUTER_API_KEY: ${getApiKey() ? 'set' : 'NOT set (see .env.example)'}`)
})
