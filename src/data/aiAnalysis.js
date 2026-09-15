// Локальная имитация AI-анализа заявки.
//
// Это единственное место, которое в будущем заменится на реальный вызов AI API.
// Наружу отдаётся Promise, поэтому интерфейс уже сейчас работает с асинхронным
// результатом: при переходе на API достаточно поменять тело getLeadAIAnalysis,
// не трогая компоненты.

const ANALYSIS_DELAY_MS = 450

// Пороговые значения, чтобы описать потенциальный доход словами.
const HIGH_VALUE_THRESHOLD = 100000
const LOW_VALUE_THRESHOLD = 30000

const interestByPriority = {
  hot: 'Клиент проявляет высокий интерес к предложению',
  warm: 'Клиент проявляет умеренный интерес к предложению',
  cold: 'Активность клиента низкая, интерес не подтверждён',
}

const actionByPriority = {
  hot: 'Связаться с клиентом в ближайшее время и уточнить детали заказа.',
  warm: 'Связаться с клиентом в течение 1–2 дней и уточнить потребности.',
  cold: 'Отправить информационные материалы и вернуться к контакту позже.',
}

function buildValueClause(value) {
  if (value >= HIGH_VALUE_THRESHOLD) return ', и заявка имеет высокий потенциальный доход'
  if (value <= LOW_VALUE_THRESHOLD) return ', но потенциальный доход по заявке невысокий'
  return ', заявка имеет средний потенциальный доход'
}

function buildReason(lead, priority) {
  const sentences = [`${interestByPriority[priority]}${buildValueClause(lead.value)}.`]

  if (lead.status === 'new') sentences.push('Заявка новая и ещё не взята в работу.')
  if (lead.status === 'processed') sentences.push('Заявка уже обработана.')

  return sentences.join(' ')
}

function buildRecommendedAction(lead, priority) {
  if (lead.status === 'processed') {
    return 'Заявка уже обработана — при необходимости назначьте повторный контакт с клиентом.'
  }

  return actionByPriority[priority]
}

export function buildLeadAIAnalysis(lead) {
  const priority = lead.heat

  return {
    priority,
    reason: buildReason(lead, priority),
    recommendedAction: buildRecommendedAction(lead, priority),
  }
}

export function getLeadAIAnalysis(lead) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(buildLeadAIAnalysis(lead)), ANALYSIS_DELAY_MS)
  })
}
