import { useMemo, useState } from 'react'
import { getDashboardStats, leads } from './data/leads'
import './App.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'leads', label: 'Заявки', icon: LeadsIcon },
  { id: 'pipeline', label: 'Воронка', icon: PipelineIcon },
  { id: 'settings', label: 'Настройки', icon: SettingsIcon },
]

const statusLabels = {
  new: 'Новая',
  hot: 'Горячая',
  processed: 'Обработана',
}

const heatLabels = {
  hot: 'Горячий',
  warm: 'Тёплый',
  cold: 'Холодный',
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const stats = useMemo(() => getDashboardStats(leads), [])

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
            <input placeholder="Поиск заявок..." />
          </div>
        </header>

        {activePage === 'dashboard' ? (
          <Dashboard stats={stats} onOpenLeads={() => setActivePage('leads')} />
        ) : (
          <Placeholder page={navItems.find((item) => item.id === activePage)?.label} />
        )}
      </main>
    </div>
  )
}

function Dashboard({ stats, onOpenLeads }) {
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

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Последние заявки</h2>
            <p>Тестовые данные без подключения базы</p>
          </div>
          <button className="ghost" onClick={onOpenLeads}>Все заявки</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Клиент</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Приоритет</th>
                <th>Сумма</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
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

function Placeholder({ page }) {
  return (
    <section className="content">
      <div className="placeholder">
        <h2>{page}</h2>
        <p>Раздел появится позже. Сейчас доступен только демонстрационный Dashboard.</p>
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
