import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export function Modal({
  title,
  onClose,
  children,
  className,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const titleId = useId()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const viewport = window.visualViewport
    const head = dialog.querySelector<HTMLElement>('.modal-head')
    const update = () => {
      if (!viewport || viewport.scale === 1) {
        dialog.style.setProperty(
          '--modal-viewport-height',
          `${viewport?.height ?? innerHeight}px`,
        )
        dialog.style.setProperty(
          '--modal-viewport-top',
          `${viewport?.offsetTop ?? 0}px`,
        )
      }
      dialog.style.setProperty(
        '--modal-padding',
        getComputedStyle(dialog).paddingTop,
      )
      if (head && head.offsetHeight > 0)
        dialog.style.setProperty(
          '--modal-head-height',
          `${head.offsetHeight}px`,
        )
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(update)
        : undefined
    if (head) observer?.observe(head)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog?.showModal()
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== ref.current || !ref.current) return
        const bounds = ref.current.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose()
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
