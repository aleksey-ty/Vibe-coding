import { useEffect, useState } from 'react'
import { getLeadAIAnalysis } from '../data/aiAnalysis'
import {
  formatMoney,
  heatLabels,
  nextStatus,
  priorityTitles,
  statusActions,
  statusLabels,
} from '../data/leadFormat'

export default function LeadDetails({ lead, onClose, onChangeStatus }) {
  const [analysis, setAnalysis] = useState(null)
  const [notice, setNotice] = useState('')

  const upcomingStatus = nextStatus[lead.status]

  useEffect(() => {
    let active = true

    getLeadAIAnalysis(lead).then((result) => {
      if (active) setAnalysis(result)
    })

    return () => {
      active = false
    }
  }, [lead])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!notice) return undefined

    const timer = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  function handleStatusChange() {
    if (!upcomingStatus) return

    onChangeStatus(upcomingStatus)
    setNotice(`Статус изменён: ${statusLabels[upcomingStatus]}`)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Подробности заявки ${lead.id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Заявка {lead.id}</p>
            <h2>{lead.name}</h2>
            <p className="muted">{lead.company}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span>Источник</span>
            <strong>{lead.source}</strong>
          </div>
          <div className="detail-item">
            <span>Статус</span>
            <strong>{statusLabels[lead.status]}</strong>
          </div>
          <div className="detail-item">
            <span>Приоритет</span>
            <strong>{heatLabels[lead.heat]}</strong>
          </div>
          <div className="detail-item">
            <span>Сумма</span>
            <strong>{formatMoney(lead.value)}</strong>
          </div>
          <div className="detail-item">
            <span>Дата</span>
            <strong>{lead.createdAt}</strong>
          </div>
          {lead.contact ? (
            <div className="detail-item">
              <span>Контакт</span>
              <strong>{lead.contact}</strong>
            </div>
          ) : null}
          {lead.description ? (
            <div className="detail-item wide">
              <span>Описание</span>
              <strong>{lead.description}</strong>
            </div>
          ) : null}
        </div>

        <div className="workflow">
          <div className="workflow-head">
            <span>Статус заявки</span>
            <strong className={`badge status-${lead.status}`}>{statusLabels[lead.status]}</strong>
          </div>

          {upcomingStatus ? (
            <button type="button" className="action-button" onClick={handleStatusChange}>
              {statusActions[lead.status]}
            </button>
          ) : (
            <p className="workflow-done">Заявка обработана — действия не требуются.</p>
          )}

          {notice ? <p className="workflow-notice">{notice}</p> : null}
        </div>

        <div className="ai-block">
          <div className="ai-block-header">
            <span className="ai-mark">AI</span>
            <h3>AI-анализ</h3>
          </div>

          {analysis ? (
            <div className="ai-body">
              <div className="ai-row">
                <span>Приоритет</span>
                <strong className={`badge heat-${analysis.priority}`}>{priorityTitles[analysis.priority]}</strong>
              </div>
              <div className="ai-section">
                <span>Причина</span>
                <p>{analysis.reason}</p>
              </div>
              <div className="ai-section">
                <span>Рекомендуемое действие</span>
                <p>{analysis.recommendedAction}</p>
              </div>
            </div>
          ) : (
            <p className="ai-loading">AI анализирует заявку…</p>
          )}
        </div>
      </div>
    </div>
  )
}
