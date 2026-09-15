// Клиентская JS-валидация формы создания заявки.
// Возвращает объект с сообщениями об ошибках: { [field]: message }.
// Пустой объект означает, что данные корректны.
//
// Модуль чистый (без React), поэтому правила можно проверять вне браузера.

// Телефон: разрешены цифры, пробелы и символы + - ( ) .
const PHONE_ALLOWED = /^[\d\s+().-]+$/
const PHONE_DIGITS_MIN = 10

// Сумма: только цифры, необязательная дробная часть (точка или запятая).
const VALUE_ALLOWED = /^\d+(?:[.,]\d+)?$/

const NAME_LETTERS = /[A-Za-zА-Яа-яЁё]/

function validateName(raw) {
  const value = raw.trim()

  if (!value) return 'Укажите имя клиента'
  if (value.length < 2) return 'Имя должно содержать минимум 2 символа'
  if (!NAME_LETTERS.test(value)) return 'Имя должно содержать буквы, а не только цифры или символы'

  return ''
}

function validateCompany(raw) {
  const value = raw.trim()

  if (value && value.length < 2) return 'Компания должна содержать минимум 2 символа'

  return ''
}

function validateContact(raw) {
  const value = raw.trim()

  if (!value) return ''
  if (!PHONE_ALLOWED.test(value)) {
    return 'Контакт может содержать только цифры, пробелы и символы + - ( )'
  }

  const digits = value.replace(/\D/g, '')
  if (digits.length < PHONE_DIGITS_MIN) return 'Телефон должен содержать минимум 10 цифр'

  return ''
}

function validateDescription(raw) {
  const value = raw.trim()

  if (!value) return 'Добавьте описание заявки'
  if (value.length < 5) return 'Описание должно содержать минимум 5 символов'

  return ''
}

function validateValue(raw) {
  const value = String(raw ?? '').trim()

  if (!value) return ''
  if (!VALUE_ALLOWED.test(value)) return 'Сумма должна быть числом без букв и лишних символов'

  const amount = Number(value.replace(',', '.'))
  if (!Number.isFinite(amount)) return 'Сумма должна быть числом'
  if (amount < 0) return 'Сумма не может быть отрицательной'

  return ''
}

export function validateLeadForm(values) {
  const errors = {}

  const name = validateName(String(values?.name ?? ''))
  if (name) errors.name = name

  const company = validateCompany(String(values?.company ?? ''))
  if (company) errors.company = company

  const contact = validateContact(String(values?.contact ?? ''))
  if (contact) errors.contact = contact

  const description = validateDescription(String(values?.description ?? ''))
  if (description) errors.description = description

  const value = validateValue(values?.value)
  if (value) errors.value = value

  return errors
}
