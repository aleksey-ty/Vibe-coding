import { useEffect, useState } from 'react'
import { validateLeadForm } from '../data/leadValidation'

const emptyForm = {
  name: '',
  company: '',
  source: '',
  contact: '',
  description: '',
  value: '',
}

export default function LeadForm({ onCreate, onClose }) {
  const [values, setValues] = useState(emptyForm)
  const [submitted, setSubmitted] = useState(false)
  const [valueHasLetters, setValueHasLetters] = useState(false)

  // Ошибки считает чистая функция (не JSX). Показываем их после первой попытки
  // отправки, поэтому при исправлении поля сообщение исчезает само.
  function collectErrors() {
    const result = validateLeadForm(values)
    if (valueHasLetters) result.value = 'Сумма должна быть числом'

    return result
  }

  const errors = submitted ? collectErrors() : {}

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleChange(event) {
    const { name, value, validity } = event.target
    setValues((current) => ({ ...current, [name]: value }))

    // Для <input type="number"> буквы не попадают в value, но браузер помечает
    // ввод флагом badInput — используем его, чтобы показать понятную ошибку.
    if (name === 'value') setValueHasLetters(Boolean(validity && validity.badInput))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = collectErrors()
    setSubmitted(true)

    if (Object.keys(nextErrors).length > 0) return

    const rawValue = values.value.trim()

    onCreate({
      name: values.name.trim(),
      company: values.company.trim(),
      source: values.source.trim(),
      contact: values.contact.trim(),
      description: values.description.trim(),
      value: rawValue === '' ? null : Number(rawValue.replace(',', '.')),
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal form-modal"
        aria-label="Новая заявка"
        noValidate
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Новая заявка</p>
            <h2>Создание заявки</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Имя клиента *</span>
            <input name="name" value={values.name} onChange={handleChange} placeholder="Анна" />
            {errors.name ? <em className="field-error">{errors.name}</em> : null}
          </label>

          <label className="field">
            <span>Компания</span>
            <input
              name="company"
              value={values.company}
              onChange={handleChange}
              placeholder="ООО Альфа"
            />
            {errors.company ? <em className="field-error">{errors.company}</em> : null}
          </label>

          <label className="field">
            <span>Источник</span>
            <input name="source" value={values.source} onChange={handleChange} placeholder="Сайт" />
          </label>

          <label className="field">
            <span>Контакт</span>
            <input
              name="contact"
              value={values.contact}
              onChange={handleChange}
              placeholder="+7 900 000-00-00"
            />
            {errors.contact ? <em className="field-error">{errors.contact}</em> : null}
          </label>

          <label className="field">
            <span>Потенциальная сумма</span>
            <input
              name="value"
              type="number"
              min="0"
              value={values.value}
              onChange={handleChange}
              placeholder="120000"
            />
            {errors.value ? <em className="field-error">{errors.value}</em> : null}
          </label>

          <label className="field wide">
            <span>Описание заявки *</span>
            <textarea
              name="description"
              rows="3"
              value={values.description}
              onChange={handleChange}
              placeholder="Интересуется разработкой сайта для компании."
            />
            {errors.description ? <em className="field-error">{errors.description}</em> : null}
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="action-button">
            Создать заявку
          </button>
        </div>
      </form>
    </div>
  )
}