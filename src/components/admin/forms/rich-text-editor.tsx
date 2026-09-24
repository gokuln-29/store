"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // Keep focus (and the cursor position) in the editor when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("RichText");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      heading: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function toggleLink() {
    if (state.link) {
      chain().unsetLink().run();
      return;
    }
    const url = window.prompt(t("linkPrompt"), "https://");
    if (url && /^(https?:\/\/|mailto:|tel:)/.test(url))
      chain().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div role="toolbar" aria-label={t("toolbar")} className="flex flex-wrap gap-0.5 border-b p-1">
      <ToolbarButton
        label={t("bold")}
        icon={Bold}
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolbarButton
        label={t("italic")}
        icon={Italic}
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolbarButton
        label={t("underline")}
        icon={UnderlineIcon}
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolbarButton
        label={t("heading")}
        icon={Heading2}
        active={state.heading}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label={t("bulletList")}
        icon={List}
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolbarButton
        label={t("orderedList")}
        icon={ListOrdered}
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolbarButton
        label={t("quote")}
        icon={Quote}
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolbarButton label={t("link")} icon={LinkIcon} active={state.link} onClick={toggleLink} />
      <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
      <ToolbarButton
        label={t("undo")}
        icon={Undo2}
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolbarButton
        label={t("redo")}
        icon={Redo2}
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}

/** WYSIWYG editor producing HTML. The server sanitizes the HTML before saving. */
export function RichTextEditor({
  id,
  value,
  onChange,
  lang,
  ariaLabelledBy,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  lang?: string;
  ariaLabelledBy?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, protocols: ["mailto", "tel"] },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        lang: lang ?? "",
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {}),
        class:
          "prose-editor min-h-40 max-w-none px-3 py-2 text-sm outline-none [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // Keep the editor in sync when the form value is reset from outside.
  useEffect(() => {
    if (
      editor &&
      !editor.isFocused &&
      value !== editor.getHTML() &&
      !(value === "" && editor.isEmpty)
    ) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className="rounded-md border focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
