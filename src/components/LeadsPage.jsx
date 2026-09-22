import { useMemo } from 'react'
import { getAnalysisStats, sortLeadsByPriority } from '../data/leads'
import { formatMoney, heatLabels, priorityTitles, statusLabels } from '../data/leadFormat'

// Раздел «Заявки»: полный список демонстрационных заявок.
// «Приоритет по сумме» (heat) и «AI-приоритет» (aiAnalysis.priority) — разные
// сущности: первая считается по сумме заявки, вторая — по смыслу заявки от AI.
export default function LeadsPage({ leads, onSelectLead, onCreateLead, onResetData, query }) {
  const prioritizedLeads = useMemo(() => sortLeadsByPriority(leads), [leads])
  const analysisStats = useMemo(() => getAnalysisStats(prioritizedLeads), [prioritizedLeads])

  return (
    <section className="content">
      <div className="stats stats-compact">
        <article className="stat-card new">
          <div>
            <p>Заявок в наборе</p>
            <strong>{prioritizedLeads.length}</strong>
          </div>
          <span>Потенциально {formatMoney(analysisStats.totalValue)}</span>
        </article>
        <article className="stat-card hot">
          <div>
            <p>С AI-анализом</p>
            <strong>{analysisStats.analyzed}</strong>
          </div>
          <span>Разобраны автоматически</span>
        </article>
        <article className="stat-card done">
          <div>
            <p>Ждут анализа</p>
            <strong>{analysisStats.pending}</strong>
          </div>
          <span>Нажмите на заявку, чтобы запустить AI</span>
        </article>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Все заявки</h2>
            <p>
              Отсортированы по приоритету. Нажмите на строку, чтобы открыть карточку заявки с AI-анализом.
              {query ? ` Фильтр по запросу: «${query}».` : ''}
            </p>
          </div>
          <div className="panel-actions">
            <button className="action-button compact" onClick={onCreateLead}>
              + Новая заявка
            </button>
            <button className="ghost" onClick={onResetData}>
              Сбросить к демо-данным
            </button>
          </div>
        </div>

        {prioritizedLeads.length === 0 ? (
          <p className="empty-state">
            Ничего не найдено. Измените поисковый запрос или сбросьте данные к демонстрационному набору.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Клиент</th>
                  <th>Компания</th>
                  <th>Источник</th>
                  <th>Статус</th>
                  <th>Приоритет по сумме</th>
                  <th>AI-приоритет</th>
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
                        <span>{lead.contact}</span>
                      </div>
                    </td>
                    <td>{lead.company}</td>
                    <td>{lead.source}</td>
                    <td>
                      <span className={`badge status-${lead.status}`}>{statusLabels[lead.status]}</span>
                    </td>
                    <td>
                      <span className={`badge heat-${lead.heat}`}>{heatLabels[lead.heat]}</span>
                    </td>
                    <td>
                      {lead.aiAnalysis ? (
                        <span className={`badge heat-${lead.aiAnalysis.priority}`}>
                          {priorityTitles[lead.aiAnalysis.priority]}
                        </span>
                      ) : (
                        <span className="pending-analysis">Не рассчитан — откройте заявку</span>
                      )}
                    </td>
                    <td>{formatMoney(lead.value)}</td>
                    <td className="muted">{lead.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}