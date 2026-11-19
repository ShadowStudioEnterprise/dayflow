import { useEffect, useId, useRef } from 'react'

export function useFormErrorFeedback<Field extends string>(
  errors: Partial<Record<Field, { message?: string }>>,
  submitCount: number,
  isSubmitting: boolean,
) {
  const form = useRef<HTMLFormElement>(null)
  const lastSubmit = useRef(0)
  const formId = useId()

  useEffect(() => {
    if (isSubmitting || submitCount === lastSubmit.current) return
    lastSubmit.current = submitCount
    const field = form.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]:not(:disabled)',
    )
    const details = field?.closest('details')
    if (details) details.open = true
    field?.focus()
  }, [submitCount, isSubmitting])

  const errorId = (field: Field) => `${formId}-${field}-error`
  const errorProps = (field: Field, helpId?: string) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby':
      [errors[field] && errorId(field), helpId].filter(Boolean).join(' ') ||
      undefined,
  })
  return { formRef: form, formId, errorId, errorProps }
}
