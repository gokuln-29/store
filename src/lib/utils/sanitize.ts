import sanitizeHtml from "sanitize-html";

/**
 * Cleans rich-text HTML from the admin editor before it is stored. Only simple formatting is
 * kept; scripts, styles, event handlers and unsafe links are removed.
 */
export function sanitizeRichText(html: string): string {
  const clean = sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "hr",
    ],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          href: attribs.href ?? "",
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  }).trim();
  // An editor with nothing typed produces "<p></p>".
  return /^(<p>(\s|<br\s*\/?>)*<\/p>)*$/.test(clean) ? "" : clean;
}
