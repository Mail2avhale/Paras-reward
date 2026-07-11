/**
 * PopupEditor — TipTap-based WYSIWYG editor for the admin popup form.
 * Emits sanitized HTML through `onChange(html)`. Toolbar: bold, italic,
 * underline, headings, bullet + numbered lists, link, undo/redo.
 */
import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading2, Heading3, Link2, Link2Off, Undo, Redo,
} from 'lucide-react';

const ToolbarBtn = ({ onClick, active, disabled, title, children, testId }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    data-testid={testId}
    className={`p-1.5 rounded-md transition-colors ${
      active
        ? 'bg-amber-500 text-black'
        : 'bg-white hover:bg-slate-100 text-slate-600'
    } border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {children}
  </button>
);

export default function PopupEditor({ value, onChange, placeholder = 'Compose your announcement…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML());
    },
    editorProps: {
      attributes: {
        'data-testid': 'popup-editor-content',
        class:
          'prose prose-sm max-w-none min-h-[180px] p-3 focus:outline-none [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline',
      },
    },
  });

  // Reset editor when the parent replaces `value` (e.g. edit-existing).
  useEffect(() => {
    if (!editor) return;
    if ((value || '') !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL (leave blank to remove):', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white" data-testid="popup-editor">
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
          testId="popup-editor-bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
          testId="popup-editor-italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
          testId="popup-editor-underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarBtn>

        <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
          testId="popup-editor-h2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
          testId="popup-editor-h3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarBtn>

        <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
          testId="popup-editor-bullets"
        >
          <List className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
          testId="popup-editor-numbers"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarBtn>

        <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

        <ToolbarBtn
          onClick={setLink}
          active={editor.isActive('link')}
          title="Insert / edit link"
          testId="popup-editor-link"
        >
          <Link2 className="w-4 h-4" />
        </ToolbarBtn>
        {editor.isActive('link') && (
          <ToolbarBtn
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Remove link"
            testId="popup-editor-unlink"
          >
            <Link2Off className="w-4 h-4" />
          </ToolbarBtn>
        )}

        <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
          testId="popup-editor-undo"
        >
          <Undo className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
          testId="popup-editor-redo"
        >
          <Redo className="w-4 h-4" />
        </ToolbarBtn>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
