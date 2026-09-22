import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LeadsTrendChart from './components/LeadsTrendChart'
import LeadDetails from './components/LeadDetails'
import LeadForm from './components/LeadForm'
import LeadsPage from './components/LeadsPage'
import PipelinePage from './components/PipelinePage'
import SettingsPage from './components/SettingsPage'
import { getDashboardStats, getHeatByValue, leads as initialLeads, sortLeadsByPriority } from './data/leads'
import { formatLeadDate, formatMoney, heatLabels, statusLabels } from './data/leadFormat'
import { getLeadAIAnalysis } from './data/aiAnalysis'
import './App.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'leads', label: 'Заявки', icon: LeadsIcon },
  { id: 'pipeline', label: 'Воронка', icon: PipelineIcon },
  { id: 'settings', label: 'Настройки', icon: SettingsIcon },
]

// Заявки хранятся только в localStorage текущего браузера: это persistence-версия
// для demo/pilot — без backend, авторизации и синхронизации между устройствами.
const LEADS_STORAGE_KEY = 'ai-lead-manager-leads-v1'

function isStoredLead(item) {
  return Boolean(item) && typeof item === 'object' && typeof item.id === 'string'
}

// Чтение initial state. Повреждённые данные (не JSON, не массив, не заявки)
// безопасно игнорируются — приложение поднимается на демо-данных.
function readStoredLeads() {
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY)
    if (!raw) return initialLeads

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return initialLeads
    if (!parsed.every(isStoredLead)) return initialLeads

    return parsed
  } catch {
    // Нет доступа к localStorage или некорректный JSON — используем демо-данные.
    return initialLeads
  }
}

function writeStoredLeads(items) {
  try {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Приватный режим или переполнение хранилища: продолжаем работать в памяти.
  }
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [leads, setLeads] = useState(readStoredLeads)
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const stats = useMemo(() => getDashboardStats(leads), [leads])
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null

  // Поиск из шапки фильтрует списки заявок по клиенту, компании, источнику
  // и описанию. Статистика считается по полному набору заявок.
  const visibleLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return leads

    return leads.filter((lead) =>
      [lead.id, lead.name, lead.company, lead.source, lead.description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query)),
    )
  }, [leads, searchQuery])

  // Запись выполняется в эффекте, а не в рендере: эффект только сохраняет
  // текущий leads и не меняет state, поэтому бесконечного цикла нет.
  useEffect(() => {
    writeStoredLeads(leads)
  }, [leads])

  // AI-анализ выполняется один раз на заявку: результат хранится в самой заявке
  // (lead.aiAnalysis) и попадает в localStorage через эффект записи leads выше.
  // inFlightAnalysis — начатые промисы по id заявки: повторный вызов во время
  // запроса переиспользует его, а не отправляет второй (защита от гонок и от
  // двойного вызова эффектов в StrictMode).
  // failedAnalysisIds — заявки, где AI ответил ошибкой: автоматического повтора
  // нет, новый запрос возможен только по явной кнопке в карточке заявки.
  const inFlightAnalysis = useRef(new Map())
  const failedAnalysisIds = useRef(new Set())
  const [analysisErrors, setAnalysisErrors] = useState({})

  // Единственная точка запуска AI-анализа в приложении.
  const runLeadAnalysis = useCallback((lead, options = {}) => {
    const force = options.force === true
    if (!lead?.id) return

    // Запрос для этой заявки уже выполняется — второй не нужен.
    if (inFlightAnalysis.current.has(lead.id)) return

    if (!force) {
      // Анализ уже сохранён в заявке — только показываем его, без запроса.
      if (lead.aiAnalysis) return
      // После ошибки автоповтора нет: только явное действие пользователя.
      if (failedAnalysisIds.current.has(lead.id)) return
    }

    // Пока идёт запрос, показываем загрузку вместо прошлой ошибки.
    setAnalysisErrors((current) => {
      if (!current[lead.id]) return current

      const next = { ...current }
      delete next[lead.id]
      return next
    })

    const request = getLeadAIAnalysis(lead)
    inFlightAnalysis.current.set(lead.id, request)

    request
      .then((analysis) => {
        // Промис выполняется только с валидным объектом: контракт (6 полей)
        // проверяет normalizeAnalysis в src/data/aiAnalysis.js, а некорректный
        // ответ отклоняет как ошибку. Сохраняем результат в заявку по id целиком.
        failedAnalysisIds.current.delete(lead.id)
        setLeads((current) =>
          current.map((item) => (item.id === lead.id ? { ...item, aiAnalysis: analysis } : item)),
        )
      })
      .catch((error) => {
        // Технические детали — в консоль, менеджеру понятный текст из
        // src/data/aiAnalysis.js. Автоматических повторов анализа здесь нет.
        console.warn(`AI-анализ заявки ${lead.id} не выполнен:`, error?.details ?? error?.message ?? error)
        failedAnalysisIds.current.add(lead.id)
        setAnalysisErrors((current) => ({
          ...current,
          [lead.id]: error?.message || 'Не удалось выполнить AI-анализ. Попробуйте ещё раз.',
        }))
      })
      .finally(() => {
        inFlightAnalysis.current.delete(lead.id)
      })
  }, [])

  // Заявка без готового анализа анализируется при открытии карточки: один запрос.
  useEffect(() => {
    if (selectedLead) runLeadAnalysis(selectedLead)
  }, [selectedLead, runLeadAnalysis])

  function selectLead(lead) {
    setSelectedLeadId(lead.id)
  }

  function resetDemoData() {
    setSelectedLeadId(null)
    setLeads(initialLeads)

    // Демо-заявки приходят без AI-анализа: забываем ошибки прошлой сессии,
    // чтобы анализ мог быть выполнен заново (без автоповторов).
    failedAnalysisIds.current.clear()
    setAnalysisErrors({})
  }

  function createLead(formValues) {
    const newLead = {
      id: `LM-${Date.now()}`,
      ...formValues,
      status: 'new',
      heat: getHeatByValue(formValues.value),
      createdAt: formatLeadDate(new Date()),
      aiAnalysis: null,
    }

    setLeads((current) => [newLead, ...current])
    setIsFormOpen(false)

    // AI-анализ новой заявки запускается через общую точку запуска: результат
    // сохраняется в самой заявке (lead.aiAnalysis) и уходит в localStorage.
    runLeadAnalysis(newLead)
  }

  function updateLeadStatus(leadId, nextStatus) {
    setLeads((current) =>
      current.map((lead) => (lead.id === leadId ? { ...lead, status: nextStatus } : lead)),
    )
  }

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <div className="backdrop" onClick={() => setMenuOpen(false)} />

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AI</span>
          <div>
            <strong>AI Lead Manager</strong>
            <p>Для малого бизнеса</p>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={activePage === item.id ? 'active' : ''}
              onClick={() => {
                setActivePage(item.id)
                setMenuOpen(false)
              }}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">АК</div>
          <div>
            <strong>Анна Ковалева</strong>
            <p>Менеджер по заявкам</p>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Открыть меню">
            <MenuIcon />
          </button>
          <div>
            <p className="eyebrow">Сегодня, 14 сентября</p>
            <h1>{activePage === 'dashboard' ? 'Dashboard' : navItems.find((item) => item.id === activePage)?.label}</h1>
          </div>
          <div className="search">
            <SearchIcon />
            <input
              placeholder="Поиск заявок..."
              aria-label="Поиск заявок"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </header>

        {activePage === 'dashboard' ? (
          <Dashboard
            leads={visibleLeads}
            stats={stats}
            onOpenLeads={() => setActivePage('leads')}
            onSelectLead={selectLead}
            onCreateLead={() => setIsFormOpen(true)}
            onResetData={resetDemoData}
          />
        ) : null}

        {activePage === 'leads' ? (
          <LeadsPage
            leads={visibleLeads}
            query={searchQuery.trim()}
            onSelectLead={selectLead}
            onCreateLead={() => setIsFormOpen(true)}
            onResetData={resetDemoData}
          />
        ) : null}

        {activePage === 'pipeline' ? <PipelinePage leads={visibleLeads} onSelectLead={selectLead} /> : null}

        {activePage === 'settings' ? <SettingsPage leads={leads} onResetData={resetDemoData} /> : null}
      </main>

      {selectedLead ? (
        <LeadDetails
          key={selectedLead.id}
          lead={selectedLead}
          analysisError={analysisErrors[selectedLead.id] ?? ''}
          onRetryAnalysis={() => runLeadAnalysis(selectedLead, { force: true })}
          onClose={() => setSelectedLeadId(null)}
          onChangeStatus={(nextStatus) => updateLeadStatus(selectedLead.id, nextStatus)}
        />
      ) : null}

      {isFormOpen ? <LeadForm onCreate={createLead} onClose={() => setIsFormOpen(false)} /> : null}
    </div>
  )
}

function Dashboard({ leads, stats, onOpenLeads, onSelectLead, onCreateLead, onResetData }) {
  const prioritizedLeads = useMemo(() => sortLeadsByPriority(leads), [leads])

  return (
    <section className="content">
      <div className="stats">
        <article className="stat-card new">
          <div>
            <p>Новые заявки</p>
            <strong>{stats.newCount}</strong>
          </div>
          <span>Нужно взять в работу</span>
        </article>
        <article className="stat-card hot">
          <div>
            <p>Горячие заявки</p>
            <strong>{stats.hotCount}</strong>
          </div>
          <span>Высокий приоритет</span>
        </article>
        <article className="stat-card done">
          <div>
            <p>Обработанные</p>
            <strong>{stats.processedCount}</strong>
          </div>
          <span>Закрыты за последние дни</span>
        </article>
      </div>

      <LeadsTrendChart />

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Последние заявки</h2>
            <p>Отсортированы по приоритету. Нажмите на строку, чтобы открыть AI-анализ заявки.</p>
          </div>
          <div className="panel-actions">
            <button className="action-button compact" onClick={onCreateLead}>
              + Новая заявка
            </button>
            <button className="ghost" onClick={onOpenLeads}>Все заявки</button>
            <button className="ghost" onClick={onResetData}>Сбросить к демо-данным</button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Клиент</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Приоритет по сумме</th>
                <th>Сумма</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {prioritizedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`row-${lead.heat} row-clickable`}
                  tabIndex={0}
                  onClick={() => onSelectLead(lead)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectLead(lead)
                    }
                  }}
                >
                  <td className="mono">{lead.id}</td>
                  <td>
                    <div className="client">
                      <strong>{lead.name}</strong>
                      <span>{lead.company}</span>
                    </div>
                  </td>
                  <td>{lead.source}</td>
                  <td>
                    <span className={`badge status-${lead.status}`}>{statusLabels[lead.status]}</span>
                  </td>
                  <td>
                    <span className={`badge heat-${lead.heat}`}>{heatLabels[lead.heat]}</span>
                  </td>
                  <td>{formatMoney(lead.value)}</td>
                  <td className="muted">{lead.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  )
}

function LeadsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7h13M8 12h13M8 17h13M3 7h.01M3 12h.01M3 17h.01" />
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h10M4 18h7" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7 1 1.1 1.7 1.2H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}
