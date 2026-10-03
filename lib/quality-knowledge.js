import fs from "node:fs/promises";
import path from "node:path";

const MAP = {
  brc: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/VIP-master-framework.md",
    "content/quality/en/PRO-documentation-structure.md",
    "content/quality/en/PR-006-internal-audits.md"
  ],
  ifs: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/VIP-master-framework.md",
    "content/quality/en/PRO-documentation-structure.md",
    "content/quality/en/PR-006-internal-audits.md"
  ],
  haccp: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/HA-001-basic-hazard-analysis.md",
    "content/quality/en/IN-001-cleaning-disinfection.md"
  ],
  complaints: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PRO-complaints.md",
    "content/quality/en/PR-003-capa.md"
  ],
  capa: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PR-003-capa.md",
    "content/quality/en/PRO-nonconforming-product.md"
  ],
  audit: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PR-006-internal-audits.md",
    "content/quality/en/PRO-documentation-structure.md"
  ],
  documents: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PR-001-document-control.md",
    "content/quality/en/PRO-documentation-structure.md"
  ],
  suppliers: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PR-002-suppliers.md",
    "content/quality/en/PRO-authenticity.md"
  ],
  traceability: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PR-004-traceability.md",
    "content/quality/en/PRO-incidents.md"
  ],
  labelling: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PR-005-allergens.md",
    "content/quality/en/PRO-labelling-release.md"
  ],
  change: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/PRO-product-development.md",
    "content/quality/en/HA-001-basic-hazard-analysis.md"
  ],
  management: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/QM-001-quality-management-procedure.md",
    "content/quality/en/PRO-documentation-structure.md"
  ],
  legal: [
    "content/quality/knowledge/PROJECT_CONTEXT.md"
  ],
  other: [
    "content/quality/knowledge/PROJECT_CONTEXT.md",
    "content/quality/en/VIP-master-framework.md",
    "content/quality/en/PRO-documentation-structure.md"
  ]
};

function stripForPrompt(value = "") {
  return String(value)
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function loadQualityKnowledge(specialist = "other") {
  const files = MAP[specialist] || MAP.other;
  const chunks = [];

  for (const relative of files) {
    try {
      const absolute = path.join(process.cwd(), relative);
      const content = await fs.readFile(absolute, "utf8");
      chunks.push(
        `### Internal implementation reference: ${path.basename(relative)}\n` +
        stripForPrompt(content)
      );
    } catch {
      // Missing optional reference must not break the assistant.
    }
  }

  return chunks.join("\n\n").slice(0, 30000);
}
