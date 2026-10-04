import { useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  ListChecks,
  CodeSquare,
  Quote,
  Link,
  Unlink,
  Undo2,
  Redo2,
} from 'lucide-react'
import { safeNoteUrl } from '../services/note-document'

export function EditorToolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      heading: e.isActive('heading'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      code: e.isActive('codeBlock'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  })
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const buttons = [
    {
      name: 'Negrita',
      icon: Bold,
      pressed: active.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      name: 'Cursiva',
      icon: Italic,
      pressed: active.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      name: 'Título de sección',
      icon: Heading2,
      pressed: active.heading,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      name: 'Lista con viñetas',
      icon: List,
      pressed: active.bullet,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      name: 'Lista numerada',
      icon: ListOrdered,
      pressed: active.ordered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      name: 'Checklist',
      icon: ListChecks,
      pressed: active.task,
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      name: 'Bloque de código',
      icon: CodeSquare,
      pressed: active.code,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      name: 'Cita',
      icon: Quote,
      pressed: active.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ]
  return (
    <>
      <div
        className="note-toolbar"
        role="group"
        aria-label="Formato del texto"
        onPointerDown={(event) => {
          if (
            !(event.target instanceof Element) ||
            !event.target.closest('button')
          )
            return
          event.preventDefault()
          // Mobile browsers may deliver selectionchange after the toolbar tap.
          // Capture the visible selection before the command restores editor focus.
          const selection = window.getSelection()
          if (
            selection?.anchorNode &&
            selection.focusNode &&
            editor.view.dom.contains(selection.anchorNode) &&
            editor.view.dom.contains(selection.focusNode)
          ) {
            editor.commands.setTextSelection({
              from: editor.view.posAtDOM(
                selection.anchorNode,
                selection.anchorOffset,
              ),
              to: editor.view.posAtDOM(
                selection.focusNode,
                selection.focusOffset,
              ),
            })
          }
        }}
      >
        {buttons.map(({ name, icon: Icon, pressed, run }) => (
          <button
            key={name}
            type="button"
            className="icon-button"
            aria-label={name}
            title={name}
            aria-pressed={pressed}
            onClick={run}
          >
            <Icon size={18} />
          </button>
        ))}
        <span className="toolbar-divider" />
        <button
          type="button"
          className="icon-button"
          aria-label="Enlace"
          title="Enlace"
          aria-pressed={active.link}
          aria-expanded={linkOpen}
          onClick={() => {
            setUrl(String(editor.getAttributes('link').href ?? ''))
            setError('')
            setLinkOpen(!linkOpen)
          }}
        >
          <Link size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Quitar enlace"
          title="Quitar enlace"
          disabled={!active.link}
          onClick={() =>
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
          }
        >
          <Unlink size={18} />
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className="icon-button"
          aria-label="Deshacer"
          title="Deshacer"
          disabled={!active.undo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Rehacer"
          title="Rehacer"
          disabled={!active.redo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={18} />
        </button>
      </div>
      {linkOpen && (
        <form
          className="note-link-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!safeNoteUrl(url.trim())) {
              setError(
                'Introduce un enlace completo https://, http:// o mailto:.',
              )
              return
            }
            const chain = editor.chain().focus().extendMarkRange('link')
            if (editor.state.selection.empty && !editor.isActive('link'))
              chain
                .insertContent({
                  type: 'text',
                  text: url.trim(),
                  marks: [{ type: 'link', attrs: { href: url.trim() } }],
                })
                .run()
            else chain.setLink({ href: url.trim() }).run()
            setLinkOpen(false)
          }}
        >
          <label htmlFor="note-link">Dirección del enlace</label>
          <div>
            <input
              id="note-link"
              autoFocus
              value={url}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="button secondary">Aplicar</button>
            <button
              type="button"
              className="text-button"
              onClick={() => setLinkOpen(false)}
            >
              Cancelar
            </button>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </>
  )
}
