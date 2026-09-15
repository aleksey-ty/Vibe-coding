export const statusLabels = {
  new: 'Новая',
  hot: 'Горячая',
  processed: 'Обработана',
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
