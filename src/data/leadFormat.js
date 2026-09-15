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

export function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}
