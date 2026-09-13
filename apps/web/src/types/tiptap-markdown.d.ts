/**
 * `tiptap-markdown` adds itself to the editor's storage at runtime but never
 * declares it, and TipTap v3 types `Storage` as an empty interface for exactly
 * this reason — extensions are meant to fill it in. Without this, reading the
 * markdown back out is a type error at every call site, and the alternative is
 * a cast wherever a note is saved.
 */
import "@tiptap/core";

declare module "@tiptap/core" {
  interface Storage {
    markdown: {
      getMarkdown: () => string;
    };
  }
}
