export const leads = [
  {
    id: 'LM-1048',
    name: 'Анна Козлова',
    company: 'Studio North',
    source: 'Сайт',
    status: 'new',
    heat: 'hot',
    value: 84000,
    createdAt: '2026-09-14 10:24',
  },
  {
    id: 'LM-1047',
    name: 'Игорь Смирнов',
    company: 'FreshMart',
    source: 'Telegram',
    status: 'new',
    heat: 'warm',
    value: 32000,
    createdAt: '2026-09-14 09:51',
  },
  {
    id: 'LM-1046',
    name: 'Мария Орлова',
    company: 'Bright Clinic',
    source: 'Email',
    status: 'hot',
    heat: 'hot',
    value: 156000,
    createdAt: '2026-09-13 18:12',
  },
  {
    id: 'LM-1045',
    name: 'Павел Иванов',
    company: 'AutoPark',
    source: 'Сайт',
    status: 'processed',
    heat: 'cold',
    value: 21000,
    createdAt: '2026-09-13 16:40',
  },
  {
    id: 'LM-1044',
    name: 'Елена Васильева',
    company: 'Home & Light',
    source: 'WhatsApp',
    status: 'hot',
    heat: 'hot',
    value: 98000,
    createdAt: '2026-09-13 14:05',
  },
  {
    id: 'LM-1043',
    name: 'Дмитрий Новиков',
    company: 'City Fitness',
    source: 'Телефон',
    status: 'processed',
    heat: 'warm',
    value: 45000,
    createdAt: '2026-09-12 19:22',
  },
  {
    id: 'LM-1042',
    name: 'Ольга Петрова',
    company: 'Bloom Cafe',
    source: 'Сайт',
    status: 'new',
    heat: 'warm',
    value: 18000,
    createdAt: '2026-09-12 11:08',
  },
  {
    id: 'LM-1041',
    name: 'Сергей Кузнецов',
    company: 'LogiGo',
    source: 'Email',
    status: 'processed',
    heat: 'hot',
    value: 210000,
    createdAt: '2026-09-11 17:33',
  },
]

export const weeklyLeadTrend = [
  { date: '2026-09-08', label: '8 сен', count: 5 },
  { date: '2026-09-09', label: '9 сен', count: 8 },
  { date: '2026-09-10', label: '10 сен', count: 6 },
  { date: '2026-09-11', label: '11 сен', count: 11 },
  { date: '2026-09-12', label: '12 сен', count: 9 },
  { date: '2026-09-13', label: '13 сен', count: 14 },
  { date: '2026-09-14', label: '14 сен', count: 7 },
]

export function getDashboardStats(items) {
  return {
    newCount: items.filter((lead) => lead.status === 'new').length,
    hotCount: items.filter((lead) => lead.status === 'hot' || lead.heat === 'hot').length,
    processedCount: items.filter((lead) => lead.status === 'processed').length,
  }
}

const heatRank = { hot: 3, warm: 2, cold: 1 }
const statusRank = { new: 3, hot: 2, processed: 1 }

export function getLeadPriority(lead) {
  const heat = heatRank[lead.heat] ?? 0
  const status = statusRank[lead.status] ?? 0
  return heat * 10 + status
}

export function sortLeadsByPriority(items) {
  return [...items].sort((a, b) => {
    const byPriority = getLeadPriority(b) - getLeadPriority(a)
    if (byPriority !== 0) return byPriority
    if (b.value !== a.value) return b.value - a.value
    return b.createdAt.localeCompare(a.createdAt)
  })
}
