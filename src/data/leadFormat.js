// Слой совместимости статусов заявки.
// Значения поля status оставлены прежними (не переименовываем данные), но
// менеджеру они показываются по понятной схеме: Новая → В работе → Обработана.

export const statusLabels = {
  new: 'Новая',
  hot: 'В работе',
  processed: 'Обработана',
}

export const nextStatus = {
  new: 'hot',
  hot: 'processed',
}

export const statusActions = {
  new: 'Взять в работу',
  hot: 'Завершить',
}

export const heatLabels = {
  hot: 'Горячий',
  warm: 'Тёплый',
  cold: 'Холодный',
}

export const priorityTitles = {
  hot: 'Горячая',
  warm: 'Тёплая',
  cold: 'Холодная',
}

// Стратегия обработки лида из AI-анализа: стабильные токены контракта
// превращаем в понятные менеджеру формулировки. Неизвестное значение
// LeadDetails покажет как есть.
export const strategyLabels = {
  qualification: 'Квалификация — сначала уточнить детали заявки',
  direct_contact: 'Предметный контакт — можно обсуждать условия',
  urgent_contact: 'Срочный контакт — связаться как можно быстрее',
  follow_up: 'Повторный контакт — вернуться к заявке позже',
  low_priority: 'Низкий приоритет — обработать после перспективных заявок',
}

export function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

// Тот же формат даты, что у тестовых заявок: '2026-09-14 10:24'.
// Благодаря этому сортировка по createdAt (строковое сравнение) продолжает работать.
export function formatLeadDate(date) {
  const pad = (value) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}
