import { useMemo } from 'react'
import { getPipeline } from '../data/leads'
import { formatMoney, priorityTitles, statusLabels } from '../data/leadFormat'

// Раздел «Воронка»: демонстрационная sales funnel по существующим заявкам.
// Стадии считаются из статуса заявки и её AI-анализа (см. getPipelineStageId),
// поэтому одна заявка находится ровно на одной стадии, а количество и суммы
// на колонках — это реальные значения из набора данных.
export default function PipelinePage({ leads, onSelectLead }) {
  const stages = useMemo(() => getPipeline(leads), [leads])
  const totalLeads = stages.reduce((sum, stage) => sum + stage.count, 0)
  const totalValue = stages.reduce((sum, stage) => sum + stage.total, 0)

  return (
    <section className="content">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Воронка продаж</h2>
            <p>
              {totalLeads} заявок на {formatMoney(totalValue)} потенциальной выручки. Стадия определяется статусом
              заявки и результатом AI-анализа.
            </p>
          </div>
        </div>

        {totalLeads === 0 ? (
          <p className="empty-state">Заявок пока нет — добавьте заявку или сбросьте данные к демо-набору.</p>
        ) : (
          <div className="pipeline">
            {stages.map((stage) => (
              <div className="pipeline-stage" key={stage.id}>
                <div className="stage-head">
                  <div>
                    <strong>{stage.title}</strong>
                    <span>{stage.hint}</span>
                  </div>
                  <span className="stage-count">{stage.count}</span>
                </div>

                <div className="stage-total">
                  <span>Потенциал</span>
                  <strong>{formatMoney(stage.total)}</strong>
                </div>

                <div className="stage-list">
                  {stage.leads.length === 0 ? (
                    <p className="stage-empty">На этой стадии заявок нет</p>
                  ) : (
                    stage.leads.map((lead) => (
                      <button
                        type="button"
                        className="lead-card"
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                      >
                        <div className="lead-card-top">
                          <span className="mono">{lead.id}</span>
                          {lead.aiAnalysis ? (
                            <span className={`badge heat-${lead.aiAnalysis.priority}`}>
                              {priorityTitles[lead.aiAnalysis.priority]}
                            </span>
                          ) : (
                            <span className="badge heat-pending">Нет AI-анализа</span>
                          )}
                        </div>

                        <strong className="lead-card-name">{lead.name}</strong>
                        <span className="lead-card-company">{lead.company}</span>

                        <div className="lead-card-bottom">
                          <span className={`badge status-${lead.status}`}>{statusLabels[lead.status]}</span>
                          <strong>{formatMoney(lead.value)}</strong>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}