import { getSchema, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'

export function safeNoteUrl(value: string): boolean {
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export const noteExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: safeNoteUrl,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
    a11y: {
      checkboxLabel: (node) =>
        `Completar: ${node.textContent || 'elemento sin texto'}`,
    },
  }),
]
const schema = getSchema(noteExtensions)
export const emptyDocument: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

/** Validate at the service boundary; derive search text from canonical JSON. */
export function normalizeDocument(content: JSONContent) {
  if (new TextEncoder().encode(JSON.stringify(content)).byteLength > 1_000_000)
    throw new Error('Esta nota supera el límite de 1 MB de texto y formato.')
  function inspect(node: JSONContent, depth: number) {
    if (depth > 50)
      throw new Error('La nota contiene demasiados niveles de listas.')
    if (
      node.type === 'heading' &&
      ![1, 2, 3].includes(Number(node.attrs?.level))
    )
      throw new Error('El nivel del título no es válido.')
    for (const mark of node.marks ?? []) {
      if (mark.type === 'link' && !safeNoteUrl(String(mark.attrs?.href ?? '')))
        throw new Error('Usa un enlace completo https://, http:// o mailto:.')
    }
    node.content?.forEach((child) => inspect(child, depth + 1))
  }
  inspect(content, 0)
  const document = schema.nodeFromJSON(content)
  if (document.type.name !== 'doc')
    throw new Error('El documento de la nota no es válido.')
  document.check()
  return {
    content: document.toJSON() as Record<string, unknown>,
    plainTextContent: document.textBetween(
      0,
      document.content.size,
      '\n',
      '\n',
    ),
  }
}
