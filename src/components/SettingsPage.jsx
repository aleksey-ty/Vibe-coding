import { useMemo } from 'react'
import { getAnalysisStats } from '../data/leads'

// Демонстрационный экран настроек. Здесь только информационные блоки о том,
// как реально работает приложение: без переключателей, которые ничего не меняют.
const aiSettings = [
  { label: 'Модель OpenRouter', value: 'deepseek/deepseek-v4-flash-0731' },
  { label: 'Structured output', value: 'Включён — ответ приходит по JSON Schema' },
  { label: 'Автоматический анализ', value: 'Включён — один запрос на заявку' },
  { label: 'Повторный анализ', value: 'Только вручную, по кнопке в карточке' },
  { label: 'Reasoning модели', value: 'Отключён (reasoning.enabled = false)' },
  { label: 'Контракт ответа', value: '6 полей: приоритет, причина, вопросы, действие, стратегия' },
]

const securitySettings = [
  { label: 'API-ключ', value: 'Скрыт — в интерфейсе не отображается' },
  { label: 'Где хранится ключ', value: 'Только на backend, в файле .env' },
  { label: 'Frontend', value: 'Секрет не получает: запросы идут через /api/analyze-lead' },
  { label: 'Ограничение частоты', value: 'Не более 20 запросов в минуту с одного IP' },
  { label: 'Проверка запроса', value: 'Обязательные поля, лимит размера тела 32 КБ' },
  { label: 'Ошибки API', value: 'Только короткие сообщения, без внутренних деталей' },
]

export default function SettingsPage({ leads, onResetData }) {
  const analysisStats = useMemo(() => getAnalysisStats(leads), [leads])

  const demoSettings = [
    { label: 'Режим', value: 'Демонстрационная версия на реальных данных набора' },
    { label: 'Хранение', value: 'localStorage браузера — данные не покидают устройство' },
    { label: 'Заявок в наборе', value: String(leads.length) },
    { label: 'С готовым AI-анализом', value: String(analysisStats.analyzed) },
    { label: 'Ждут AI-анализа', value: String(analysisStats.pending) },
    { label: 'Потенциальная сумма набора', value: new Intl.NumberFormat('ru-RU').format(analysisStats.totalValue) + ' ₽' },
  ]

  return (
    <section className="content">
      <div className="demo-banner">
        <span className="demo-badge">Демонстрационная версия</span>
        <p>
          Часть настроек в этой версии представлена как демонстрация: данные хранятся в браузере, а AI-ключ
          и модель задаются на backend. Переключателей, которые ничего не меняют, здесь нет.
        </p>
      </div>

      <div className="settings-grid">
        <article className="settings-card">
          <div className="settings-head">
            <span className="ai-mark">AI</span>
            <div>
              <h3>AI-анализ</h3>
              <p>Как формируется приоритет заявки и рекомендации менеджеру</p>
            </div>
          </div>
          <div className="info-list">
            {aiSettings.map((item) => (
              <div className="info-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-head">
            <span className="settings-mark">✓</span>
            <div>
              <h3>Безопасность</h3>
              <p>Где живёт секрет и как защищён AI-endpoint</p>
            </div>
          </div>
          <div className="info-list">
            {securitySettings.map((item) => (
              <div className="info-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="settings-card settings-card-wide">
          <div className="settings-head">
            <span className="settings-mark">◍</span>
            <div>
              <h3>Демо-данные</h3>
              <p>Состояние демонстрационного набора заявок</p>
            </div>
          </div>
          <div className="info-list">
            {demoSettings.map((item) => (
              <div className="info-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <button className="ghost" onClick={onResetData}>
            Сбросить к демо-данным
          </button>
        </article>
      </div>
    </section>
  )
}