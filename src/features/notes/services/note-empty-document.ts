import type { JSONContent } from '@tiptap/core'

export const emptyDocument: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}
