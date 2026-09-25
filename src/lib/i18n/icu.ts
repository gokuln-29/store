/**
 * ICU argument names used in a message, e.g. "{count, plural, =1 {# item for {name}}}" →
 * [count, name]. Plural/select branch bodies are text, so words in them are not arguments.
 */
export function placeholders(message: string): string[] {
  const names = new Set<string>();
  let i = 0;
  const text = (): void => {
    while (i < message.length && message[i] !== "}") {
      if (message[i] === "'" && "{}#|'".includes(message[i + 1] ?? "")) {
        // Quoted literal text ('{…}') or an escaped quote (''); other apostrophes are plain text.
        const end = message.indexOf("'", i + 1);
        i = end === -1 ? message.length : end + 1;
      } else if (message[i] === "{") {
        i += 1;
        argument();
      } else i += 1;
    }
  };
  const argument = (): void => {
    const name = /^\s*([A-Za-z_]\w*)\s*/.exec(message.slice(i));
    if (!name) return;
    names.add(name[1]!);
    i += name[0].length;
    if (message[i] === "}") return void (i += 1);
    const type = /^,\s*(\w+)\s*/.exec(message.slice(i));
    i += type ? type[0].length : 0;
    if (type && ["plural", "select", "selectordinal"].includes(type[1]!)) {
      if (message[i] === ",") i += 1;
      // selector {body} selector {body} … }
      while (i < message.length && message[i] !== "}") {
        const open = message.indexOf("{", i);
        if (open === -1) return void (i = message.length);
        i = open + 1;
        text();
        i += 1; // closing } of the branch
        while (/\s/.test(message[i] ?? "")) i += 1;
      }
      i += 1;
    } else {
      // number/date with a style: skip to the closing brace
      const close = message.indexOf("}", i);
      i = close === -1 ? message.length : close + 1;
    }
  };
  text();
  return [...names].sort();
}
