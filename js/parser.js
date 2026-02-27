export function parseTextToHTML(text) {
  const lines = text.split("\n");
  let html = "";
  let inList = [];
  let inCodeBlock = false;

  for (let rawLine of lines) {
    let line = rawLine;

    // Gestion code blocks ``` 
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) html += "<pre><code>";
      else html += "</code></pre>";
      continue;
    }

    if (inCodeBlock) {
      html += escapeHTML(line) + "\n";
      continue;
    }

    line = line.trim();

    // TITRES
    if (line.startsWith("#### ")) { closeAllLists(); html += `<h4>${inline(line.slice(5))}</h4>`; continue; }
    if (line.startsWith("### ")) { closeAllLists(); html += `<h3>${inline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith("## ")) { closeAllLists(); html += `<h2>${inline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith("# ")) { closeAllLists(); html += `<h1>${inline(line.slice(2))}</h1>`; continue; }

    // BLOCKQUOTE
    if (line.startsWith("> ")) { closeAllLists(); html += `<blockquote>${inline(line.slice(2))}</blockquote>`; continue; }

    // LISTES ORDINAIRES / NUMÉROTÉES
    let matchUL = line.match(/^(\s*)- (.+)/);
    let matchOL = line.match(/^(\s*)\d+\. (.+)/);

    if (matchUL || matchOL) {
      const indent = matchUL ? matchUL[1].length : matchOL[1].length;
      const content = matchUL ? matchUL[2] : matchOL[2];
      const type = matchUL ? "ul" : "ol";

      // Gestion imbriquée
      while (inList.length > indent / 2) {
        html += `</${inList.pop()}>`;
      }
      if (inList.length < indent / 2) {
        html += `<${type}>`;
        inList.push(type);
      }

      html += `<li>${inline(content)}</li>`;
      continue;
    }

    // Ligne vide = fin de listes
    if (line === "") { closeAllLists(); continue; }

    // PARAGRAPHE
    closeAllLists();
    html += `<p>${inline(line)}</p>`;
  }

  closeAllLists();
  return html;

  function closeAllLists() {
    while (inList.length > 0) html += `</${inList.pop()}>`;
  }
}

// ---------------- INLINE FORMATTING ----------------
function inline(text) {
  // Process images and links BEFORE escaping to preserve URLs
  let out = text
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, alt, url) => `<img src="${url}" alt="${escapeHTML(alt)}" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0;">`
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`
    );

  // Split on HTML tags to escape only text parts
  out = out.split(/(<[^>]+>)/).map((part, i) => {
    if (i % 2 === 1) return part; // HTML tag, leave alone
    return escapeHTML(part)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/~~(.+?)~~/g, "<s>$1</s>");
  }).join("");

  return out;
}

function escapeHTML(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}


export function deparseHTMLToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return walk(doc.body).trim();
}

function walk(node, indent = 0) {
  let out = "";

  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const tag = child.tagName.toLowerCase();

    switch (tag) {
      case "h1": out += `# ${walk(child)}\n\n`; break;
      case "h2": out += `## ${walk(child)}\n\n`; break;
      case "h3": out += `### ${walk(child)}\n\n`; break;
      case "h4": out += `#### ${walk(child)}\n\n`; break;

      case "p": out += `${walk(child)}\n\n`; break;

      case "strong": out += `**${walk(child)}**`; break;
      case "em": out += `_${walk(child)}_`; break;
      case "s": out += `~~${walk(child)}~~`; break;
      case "code":
        if (child.parentElement?.tagName === "PRE") {
          out += "```\n" + child.textContent + "\n```\n\n";
        } else {
          out += "`" + child.textContent + "`";
        }
        break;

      case "blockquote":
        out += `> ${walk(child)}\n\n`;
        break;

      case "ul":
        child.querySelectorAll(":scope > li").forEach(li => {
          out += `${" ".repeat(indent)}- ${walk(li)}\n`;
        });
        out += "\n";
        break;

      case "ol":
        let i = 1;
        child.querySelectorAll(":scope > li").forEach(li => {
          out += `${" ".repeat(indent)}${i++}. ${walk(li)}\n`;
        });
        out += "\n";
        break;

      case "li":
        out += walk(child, indent + 2);
        break;

      case "img":
        out += `![${child.getAttribute("alt") || ""}](${child.getAttribute("src")})`;
        break;

      case "a":
        out += `[${walk(child)}](${child.getAttribute("href")})`;
        break;

      case "pre":
        out += walk(child);
        break;

      case "br":
        out += "\n";
        break;

      default:
        out += walk(child);
    }
  });

  return out;
}
