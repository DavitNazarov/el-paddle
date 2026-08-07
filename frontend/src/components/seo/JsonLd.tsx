type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/**
 * Serialize structured data for an inline `application/ld+json` block.
 *
 * `JSON.stringify` escapes quotes, backslashes and control characters but never
 * `<`, and the HTML parser ends a script block at the first literal `</script`
 * regardless of JSON context. Club names, descriptions and player names reach
 * this component from user input, so an unescaped `<` is a stored-XSS sink on
 * the public club and player pages. `<` is valid JSON and valid JSON-LD:
 * consumers parse it identically, and output is unchanged for any input
 * without a `<`.
 */
export function jsonLdPayload(data: JsonLdProps['data']) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdPayload(data) }}
    />
  );
}
