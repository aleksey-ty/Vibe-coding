// AI-анализ заявки через собственный backend.
//
// Frontend не обращается к OpenRouter напрямую и не знает про API-ключ: ключ
// живёт на сервере (.env, server/index.js), а сюда приходит уже проверенный
// объект квалификации лида:
//   { priority, reason, missingInformation, qualificationQuestions,
//     recommendedAction, salesStrategy }
//
// Внешний контракт сохранён: getLeadAIAnalysis(lead) -> Promise<analysis>.

const ANALYZE_ENDPOINT = '/api/analyze-lead'

const PRIORITIES = ['hot', 'warm', 'cold']

// Понятные менеджеру сообщения по HTTP-статусам backend.
// Технические детали уходят в error.details (только в консоль).
const USER_MESSAGES = {
  429: 'AI временно недоступен из-за лимита запросов. Попробуйте позже.',
  401: 'Ошибка авторизации AI. Проверьте API key.',
  504: 'AI не ответил вовремя. Попробуйте повторить анализ.',
  502: 'AI вернул некорректный ответ. Попробуйте повторить анализ.',
}

const DEFAULT_USER_MESSAGE = 'Не удалось выполнить AI-анализ. Попробуйте ещё раз.'
const NETWORK_USER_MESSAGE =
  'Не удалось связаться с сервером AI-анализа. Проверьте, запущен ли backend (npm run server).'

// Пользователь видит понятный текст, технические детали пишем в error.details.
// Автоматических повторов запроса здесь нет: один вызов — один запрос.
function createAnalysisError(userMessage, details) {
  const error = new Error(userMessage)
  error.details = details
  return error
}

// В backend уходит только то, что нужно для анализа заявки.
function buildLeadPayload(lead) {
  return {
    name: lead.name,
    company: lead.company,
    source: lead.source,
    contact: lead.contact,
    description: lead.description,
    value: lead.value,
    status: lead.status,
    heat: lead.heat,
  }
}

// Техническое сообщение backend ({ error: '...' }) — только для консоли.
// Менеджеру показывается понятный текст из USER_MESSAGES.
async function readErrorMessage(response) {
  try {
    const data = await response.json()
    return typeof data?.error === 'string' && data.error.trim() ? data.error.trim() : null
  } catch {
    return null
  }
}

// Список строк из ответа AI: нестроковые и пустые элементы отбрасываются,
// чтобы UI не показывал пустые пункты.
function normalizeStringList(value) {
  if (!Array.isArray(value)) return []

  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
}

// Защита от неожиданного ответа: UI ожидает строго этот контракт.
function normalizeAnalysis(payload) {
  if (!payload || typeof payload !== 'object') return null

  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''
  const recommendedAction =
    typeof payload.recommendedAction === 'string' ? payload.recommendedAction.trim() : ''
  const salesStrategy = typeof payload.salesStrategy === 'string' ? payload.salesStrategy.trim() : ''

  if (!PRIORITIES.includes(payload.priority)) return null
  if (!reason || !recommendedAction || !salesStrategy) return null

  return {
    priority: payload.priority,
    reason,
    missingInformation: normalizeStringList(payload.missingInformation),
    qualificationQuestions: normalizeStringList(payload.qualificationQuestions),
    recommendedAction,
    salesStrategy,
  }
}

export async function getLeadAIAnalysis(lead) {
  let response

  try {
    response = await fetch(ANALYZE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLeadPayload(lead)),
    })
  } catch (error) {
    throw createAnalysisError(NETWORK_USER_MESSAGE, `network: ${error?.message ?? 'request failed'}`)
  }

  if (!response.ok) {
    const details = await readErrorMessage(response)
    const userMessage = USER_MESSAGES[response.status] ?? DEFAULT_USER_MESSAGE

    throw createAnalysisError(userMessage, details ?? `HTTP ${response.status}`)
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw createAnalysisError(DEFAULT_USER_MESSAGE, 'invalid JSON response')
  }

  const analysis = normalizeAnalysis(payload)
  if (!analysis) throw createAnalysisError(USER_MESSAGES[502], 'unexpected analysis payload')

  return analysis
}

