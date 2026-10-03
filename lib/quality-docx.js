import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  NumberFormat,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from "docx";

const COLORS = {
  navy: "153A5B",
  blue: "1F5F8B",
  teal: "167C80",
  lightBlue: "EAF2F8",
  paleTeal: "E7F3F2",
  gray: "F2F4F6",
  midGray: "D7DEE5",
  text: "1F2937",
  muted: "5F6B76",
  white: "FFFFFF",
  danger: "8B1E1E"
};

const border = (color = COLORS.midGray, size = 4) => ({
  style: BorderStyle.SINGLE,
  color,
  size
});

function cleanMarkdown(text = "") {
  return String(text)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function extractDocIdentity(markdown, product, lang) {
  const firstHeading = cleanMarkdown(markdown)
    .split("\n")
    .find((line) => /^#\s+/.test(line));

  const headingText = firstHeading
    ? firstHeading.replace(/^#\s+/, "").trim()
    : (lang === "en" ? product.name_en : product.name_pl);

  const codeMatch = headingText.match(/^([A-Z]{1,5}-?\d{2,4})\b/);
  const code = codeMatch?.[1] || String(product.slug || "QAS-DOC").toUpperCase().slice(0, 20);
  const title = codeMatch
    ? headingText.slice(codeMatch[0].length).replace(/^\s*[—–-]\s*/, "").trim()
    : headingText;

  return { code, title: title || (lang === "en" ? product.name_en : product.name_pl) };
}

function richRuns(text, options = {}) {
  const value = String(text || "");
  const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part) => {
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const content = bold ? part.slice(2, -2) : part;
    return new TextRun({
      text: content,
      bold: bold || options.bold,
      italics: options.italics,
      color: options.color || COLORS.text,
      size: options.size || 20,
      font: options.font || "Aptos"
    });
  });
}

function paragraph(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment,
    keepNext: options.keepNext,
    keepLines: options.keepLines,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 120,
      line: options.line ?? 276
    },
    indent: options.indent,
    bullet: options.bullet ? { level: 0 } : undefined,
    children: richRuns(text, options)
  });
}

function heading(text, level = 1) {
  const map = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3
  };

  return new Paragraph({
    heading: map[level] || HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: {
      before: level === 1 ? 220 : 160,
      after: level === 1 ? 110 : 80
    },
    children: [
      new TextRun({
        text,
        bold: true,
        font: "Aptos Display",
        size: level === 1 ? 25 : level === 2 ? 22 : 20,
        color: level === 1 ? COLORS.navy : COLORS.blue
      })
    ]
  });
}

function tableCell(text, options = {}) {
  return new TableCell({
    width: options.width
      ? { size: options.width, type: WidthType.DXA }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill
      ? { fill: options.fill, type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    borders: {
      top: border(options.borderColor),
      bottom: border(options.borderColor),
      left: border(options.borderColor),
      right: border(options.borderColor)
    },
    children: [
      new Paragraph({
        alignment: options.alignment || AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 240 },
        children: richRuns(text, {
          bold: options.bold,
          color: options.color || COLORS.text,
          size: options.size || 18
        })
      })
    ]
  });
}

function metadataTable(identity, lang) {
  const labels = lang === "en"
    ? {
        company: "COMPANY / SITE",
        code: "DOCUMENT CODE",
        version: "VERSION",
        issue: "ISSUE DATE",
        effective: "EFFECTIVE DATE",
        owner: "PROCESS OWNER",
        prepared: "PREPARED BY",
        approved: "APPROVED BY",
        status: "STATUS"
      }
    : {
        company: "FIRMA / ZAKŁAD",
        code: "KOD DOKUMENTU",
        version: "WERSJA",
        issue: "DATA WYDANIA",
        effective: "DATA OBOWIĄZYWANIA",
        owner: "WŁAŚCICIEL PROCESU",
        prepared: "OPRACOWAŁ",
        approved: "ZATWIERDZIŁ",
        status: "STATUS"
      };

  const rows = [
    [labels.company, "[NAZWA FIRMY] / [ZAKŁAD]", labels.code, identity.code],
    [labels.version, "1.0", labels.issue, "[RRRR-MM-DD]"],
    [labels.effective, "[RRRR-MM-DD]", labels.owner, "[STANOWISKO]"],
    [labels.prepared, "[IMIĘ / STANOWISKO]", labels.approved, "[IMIĘ / STANOWISKO]"],
    [labels.status, lang === "en" ? "CONTROLLED DOCUMENT" : "DOKUMENT NADZOROWANY", "", ""]
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [2200, 3000, 2200, 2600],
    borders: {
      top: border(COLORS.midGray),
      bottom: border(COLORS.midGray),
      left: border(COLORS.midGray),
      right: border(COLORS.midGray),
      insideHorizontal: border(COLORS.midGray),
      insideVertical: border(COLORS.midGray)
    },
    rows: rows.map((row, rowIndex) => new TableRow({
      children: row.map((value, index) => {
        const isLabel = index % 2 === 0;
        const isStatusValue = rowIndex === rows.length - 1 && index === 1;
        return tableCell(value, {
          fill: isLabel ? COLORS.lightBlue : isStatusValue ? COLORS.paleTeal : COLORS.white,
          bold: isLabel || isStatusValue,
          color: isStatusValue ? COLORS.teal : COLORS.text,
          size: 17
        });
      })
    }))
  });
}

function controlledHeader(identity, lang) {
  const left = lang === "en" ? "[COMPANY LOGO]" : "[LOGO FIRMY]";
  const controlLabel = lang === "en" ? "CONTROLLED DOCUMENT" : "DOKUMENT NADZOROWANY";

  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: [2200, 5200, 2600],
        borders: {
          top: border(COLORS.navy, 6),
          bottom: border(COLORS.navy, 6),
          left: border(COLORS.navy, 6),
          right: border(COLORS.navy, 6),
          insideHorizontal: border(COLORS.midGray),
          insideVertical: border(COLORS.midGray)
        },
        rows: [
          new TableRow({
            children: [
              tableCell(left, {
                fill: COLORS.navy,
                bold: true,
                color: COLORS.white,
                alignment: AlignmentType.CENTER,
                size: 17
              }),
              tableCell(identity.title.toUpperCase(), {
                fill: COLORS.white,
                bold: true,
                color: COLORS.navy,
                alignment: AlignmentType.CENTER,
                size: 19
              }),
              tableCell(
                `${controlLabel}\n${identity.code} · v1.0`,
                {
                  fill: COLORS.paleTeal,
                  bold: true,
                  color: COLORS.teal,
                  alignment: AlignmentType.CENTER,
                  size: 16
                }
              )
            ]
          })
        ]
      }),
      new Paragraph({ spacing: { after: 80 }, children: [] })
    ]
  });
}

function controlledFooter(identity, lang) {
  const notice = lang === "en"
    ? "CONTROLLED DOCUMENT · Printed copies are uncontrolled unless specifically authorised."
    : "DOKUMENT NADZOROWANY · Wydruk jest kopią niekontrolowaną, jeżeli nie oznaczono inaczej.";

  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 80, after: 0 },
        border: {
          top: {
            style: BorderStyle.SINGLE,
            color: COLORS.midGray,
            size: 4,
            space: 1
          }
        },
        children: [
          new TextRun({
            text: `${notice} · ${identity.code} · `,
            size: 15,
            color: COLORS.muted,
            font: "Aptos"
          }),
          new TextRun({
            children: [
              lang === "en" ? "Page " : "Strona ",
              PageNumber.CURRENT,
              lang === "en" ? " of " : " z ",
              PageNumber.TOTAL_PAGES
            ],
            size: 15,
            bold: true,
            color: COLORS.navy,
            font: "Aptos"
          })
        ]
      })
    ]
  });
}

function markdownTable(lines, startIndex) {
  const separator = lines[startIndex + 1] || "";
  if (!/^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(separator)) {
    return null;
  }

  const rows = [];
  let i = startIndex;
  while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
    if (i !== startIndex + 1) {
      const cells = lines[i]
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
      rows.push(cells);
    }
    i += 1;
  }

  return { rows, nextIndex: i };
}

function renderDataTable(rows, options = {}) {
  const maxCols = Math.max(...rows.map((r) => r.length), 1);
  const tiny = maxCols >= 7;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: border(COLORS.midGray),
      bottom: border(COLORS.midGray),
      left: border(COLORS.midGray),
      right: border(COLORS.midGray),
      insideHorizontal: border(COLORS.midGray),
      insideVertical: border(COLORS.midGray)
    },
    rows: rows.map((row, rowIndex) => new TableRow({
      tableHeader: rowIndex === 0,
      children: Array.from({ length: maxCols }, (_, colIndex) => {
        const value = row[colIndex] ?? "";
        return tableCell(value, {
          fill: rowIndex === 0 ? COLORS.navy : rowIndex % 2 === 0 ? COLORS.gray : COLORS.white,
          color: rowIndex === 0 ? COLORS.white : COLORS.text,
          bold: rowIndex === 0,
          alignment: rowIndex === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          size: tiny ? 14 : 17
        });
      })
    }))
  });
}

function callout(text, lang) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: border(COLORS.teal),
      bottom: border(COLORS.teal),
      left: border(COLORS.teal, 10),
      right: border(COLORS.teal)
    },
    rows: [
      new TableRow({
        children: [
          tableCell(
            `${lang === "en" ? "IMPLEMENTATION NOTE" : "UWAGA WDROŻENIOWA"}\n${text}`,
            {
              fill: COLORS.paleTeal,
              color: COLORS.text,
              size: 17
            }
          )
        ]
      })
    ]
  });
}

function responsibilityTable(items, lang) {
  const headers = lang === "en"
    ? ["Role", "Responsibility"]
    : ["Rola / stanowisko", "Odpowiedzialność"];

  const rows = items.map((item) => {
    const splitAt = item.indexOf(":");
    if (splitAt === -1) return [item, "[DO UZUPEŁNIENIA]"];
    return [
      item.slice(0, splitAt).trim(),
      item.slice(splitAt + 1).trim()
    ];
  });

  return renderDataTable([headers, ...rows]);
}

function recordsTable(items, lang) {
  const headers = lang === "en"
    ? ["Record", "Owner", "Storage / system", "Retention"]
    : ["Zapis / formularz", "Właściciel", "Miejsce / system", "Retencja"];

  const rows = items.map((item) => [
    item,
    lang === "en" ? "[ROLE]" : "[STANOWISKO]",
    "[DMS / FOLDER]",
    lang === "en" ? "[PER RETENTION MATRIX]" : "[ZGODNIE Z MATRYCĄ RETENCJI]"
  ]);

  return renderDataTable([headers, ...rows]);
}

function markdownToBlocks(markdown, lang) {
  const rawLines = cleanMarkdown(markdown).split("\n");
  const lines = rawLines.filter((line) => !/^#\s+/.test(line));
  const blocks = [];
  let currentSection = "";

  for (let i = 0; i < lines.length;) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (/^\*\*(Właściciel|Owner|Zatwierdził|Approved by|Wersja|Version|Data|Date):\*\*/i.test(line)) {
      i += 1;
      continue;
    }

    const h = line.match(/^(#{2,4})\s+(.+)$/);
    if (h) {
      currentSection = h[2].trim().toLowerCase();
      blocks.push(heading(h[2].trim(), Math.min(h[1].length - 1, 3)));
      i += 1;
      continue;
    }

    if (line.startsWith(">")) {
      blocks.push(callout(line.replace(/^>\s?/, ""), lang));
      i += 1;
      continue;
    }

    if (line.includes("|")) {
      const parsed = markdownTable(lines, i);
      if (parsed) {
        blocks.push(renderDataTable(parsed.rows));
        blocks.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
        i = parsed.nextIndex;
        continue;
      }
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^[-*]\s+/.test(lines[j].trim())) {
        items.push(lines[j].trim().replace(/^[-*]\s+/, ""));
        j += 1;
      }

      const responsibilitySection =
        currentSection.includes("odpowiedzial") ||
        currentSection.includes("responsibilit");

      const recordsSection =
        currentSection.includes("zapis") ||
        currentSection.includes("rejestr") ||
        currentSection.includes("record");

      if (responsibilitySection) {
        blocks.push(responsibilityTable(items, lang));
        blocks.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      } else if (recordsSection) {
        blocks.push(recordsTable(items, lang));
        blocks.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      } else {
        for (const item of items) {
          blocks.push(paragraph(item, {
            bullet: true,
            after: 55,
            indent: { left: 360, hanging: 180 }
          }));
        }
      }

      i = j;
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      blocks.push(paragraph(line, {
        after: 65,
        indent: { left: 220 }
      }));
      i += 1;
      continue;
    }

    blocks.push(paragraph(line, { after: 100 }));
    i += 1;
  }

  return blocks;
}

function revisionHistory(lang) {
  const labels = lang === "en"
    ? ["Version", "Date", "Change / reason", "Author", "Approval"]
    : ["Wersja", "Data", "Zmiana / przyczyna", "Autor", "Zatwierdzenie"];

  const initial = lang === "en" ? "Initial issue" : "Wydanie początkowe";

  return [
    heading(lang === "en" ? "Revision history" : "Historia zmian", 1),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          tableHeader: true,
          children: labels.map((x) => tableCell(x, {
            fill: COLORS.navy,
            color: COLORS.white,
            bold: true,
            alignment: AlignmentType.CENTER,
            size: 16
          }))
        }),
        new TableRow({
          children: ["1.0", "[RRRR-MM-DD]", initial, "[IMIĘ]", "[IMIĘ]"].map((x) =>
            tableCell(x, { size: 16 })
          )
        }),
        new TableRow({
          children: ["", "", "", "", ""].map((x) =>
            tableCell(x, { size: 16 })
          )
        })
      ]
    })
  ];
}

function documentNote(lang) {
  const text = lang === "en"
    ? "This is an editable implementation template. Before approval, adapt it to the actual site, process, product, responsibilities, legal requirements and risk assessment. Replace every field in square brackets."
    : "To jest edytowalny szablon wdrożeniowy. Przed zatwierdzeniem należy dostosować go do rzeczywistego zakładu, procesu, produktu, odpowiedzialności, wymagań prawnych i oceny ryzyka. Wszystkie pola w nawiasach kwadratowych należy uzupełnić.";

  return callout(text, lang);
}

function documentStyles() {
  return {
    default: {
      document: {
        run: {
          font: "Aptos",
          size: 20,
          color: COLORS.text
        },
        paragraph: {
          spacing: {
            after: 120,
            line: 276
          }
        }
      }
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: {
          font: "Aptos Display",
          size: 25,
          bold: true,
          color: COLORS.navy
        },
        paragraph: {
          spacing: { before: 220, after: 110 },
          outlineLevel: 0
        }
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: {
          font: "Aptos Display",
          size: 22,
          bold: true,
          color: COLORS.blue
        },
        paragraph: {
          spacing: { before: 160, after: 80 },
          outlineLevel: 1
        }
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: {
          font: "Aptos",
          size: 20,
          bold: true,
          color: COLORS.teal
        },
        paragraph: {
          spacing: { before: 120, after: 70 },
          outlineLevel: 2
        }
      }
    ]
  };
}

export async function buildQualityDocx({ product, markdown, lang = "pl" }) {
  const identity = extractDocIdentity(markdown, product, lang);
  const landscape =
    product.slug === "hazard-analysis-basic" ||
    identity.code.startsWith("HA-");

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: "QUALITY ASSURANCE SUPPORT",
          bold: true,
          size: 17,
          color: COLORS.teal,
          font: "Aptos"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: identity.title,
          bold: true,
          size: 31,
          color: COLORS.navy,
          font: "Aptos Display"
        })
      ]
    }),
    metadataTable(identity, lang),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    documentNote(lang),
    ...markdownToBlocks(markdown, lang),
    ...revisionHistory(lang)
  ];

  const doc = new Document({
    creator: "Quality Assurance Support",
    title: identity.title,
    subject: lang === "en"
      ? "Controlled food quality and safety management template"
      : "Nadzorowany szablon zarządzania jakością i bezpieczeństwem żywności",
    description: "Editable Quality Assurance Support controlled-document template",
    styles: documentStyles(),
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT
            },
            margin: landscape
              ? { top: 650, right: 650, bottom: 650, left: 650, header: 300, footer: 320 }
              : { top: 780, right: 780, bottom: 780, left: 780, header: 320, footer: 340 },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL
            }
          }
        },
        headers: {
          default: controlledHeader(identity, lang)
        },
        footers: {
          default: controlledFooter(identity, lang)
        },
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}
