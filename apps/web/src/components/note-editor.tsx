"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { cn } from "@/lib/utils";

/**
 * A note, edited the way Notion edits one. Ported from myTask minus file
 * attachments.
 *
 * The store is markdown, not a block tree: a note typed on a phone stays
 * readable on a phone, and nothing is trapped in a shape only this editor
 * understands.
 *
 * On the board the editor is always live, never a rendered copy waiting to be
 * clicked: TipTap will not touch the document while read-only, so a checkbox
 * in a read-only note flips on screen and springs back. `editable` stays for
 * the dashboard strip, where notes are a preview.
 */

const NEWLINE = String.fromCharCode(10);
const EXTRA_GAPS = new RegExp(NEWLINE + "{3,}", "g");

/** A checklist after a bullet list comes back with a blank item in front; strip it in the markdown… */
function stripBlankTasks(markdown: string): string {
  const BLANK_TASK = /^[ \t]*[-*][ \t]*\[[ xX]?\][ \t]*$/;
  return markdown
    .split(NEWLINE)
    .filter((line) => !BLANK_TASK.test(line))
    .join(NEWLINE)
    .replace(EXTRA_GAPS, NEWLINE + NEWLINE);
}

/** …and in the document, or the checkbox stays on screen. */
function dropBlankTaskItems(editor: Editor): void {
  const ranges: Array<{ from: number; to: number }> = [];
  editor.state.doc.descendants((node, pos) => {
    const name = node.type.name;
    if ((name === "taskItem" || name === "taskList") && node.textContent.trim() === "") {
      ranges.push({ from: pos, to: pos + node.nodeSize });
      return false;
    }
    return true;
  });
  if (!ranges.length) return;
  const tr = editor.state.tr;
  for (const { from, to } of ranges.reverse()) tr.delete(from, to);
  editor.view.dispatch(tr.setMeta("addToHistory", false));
}

export function NoteEditor({
  value,
  editable,
  onChange,
  onBlur,
  onEscape,
  autoFocus = false,
  className,
}: {
  value: string;
  editable: boolean;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    // Client only: ProseMirror measures the DOM; letting the server guess
    // produces a hydration mismatch on every note.
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: true, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write something — - for a list, [] for a checkbox" }),
      Markdown.configure({ html: false, bulletListMarker: "-", transformPastedText: true, transformCopiedText: true }),
    ],
    content: value,
    editorProps: { attributes: { class: "note-prose text-sm leading-relaxed outline-none" } },
    onCreate: ({ editor }) => dropBlankTaskItems(editor),
    onUpdate: ({ editor }) => onChange(stripBlankTasks(editor.storage.markdown.getMarkdown())),
    onBlur: () => onBlur?.(),
    // No dependency array: rebuilding the editor on every prop change tears it
    // down while effects still hold the old one.
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // An edit from elsewhere lands here, but only when it genuinely differs
  // from what is on screen, or it would fight the cursor on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const current = stripBlankTasks(editor.storage.markdown.getMarkdown());
    if (stripBlankTasks(value).trim() !== current.trim()) {
      editor.commands.setContent(value, { emitUpdate: false });
      dropBlankTaskItems(editor);
    }
  }, [editor, value]);

  useEffect(() => {
    if (editor && editable && autoFocus) editor.commands.focus("end");
  }, [editor, editable, autoFocus]);

  if (!editor) {
    return <div className={cn("whitespace-pre-wrap text-sm leading-relaxed", className)}>{value}</div>;
  }

  return (
    <div
      className={className}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onEscape?.();
        }
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
