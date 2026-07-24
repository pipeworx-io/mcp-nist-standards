interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * NIST Standards MCP pack
 *
 * Keyless, self-contained lookup for the most-referenced NIST cybersecurity /
 * privacy CONTROLS: SP 800-53 Rev 5 (security & privacy controls, incl. control
 * enhancements) and SP 800-171 Rev 3 (CUI security requirements). The full
 * catalog is embedded at build time from official NIST OSCAL content — no
 * network access at runtime.
 */

import { CONTROLS, type NistControl } from './catalog';

// ---- id normalization -------------------------------------------------------
// Build a lookup keyed by a canonical form so we can accept forgiving inputs:
//   "AC-2", "ac-2", "AC-02", "AC-2(1)", "AC-2.1", "ac 2", "NIST 800-53 AC-2"
//   "3.1.1", "3.01.01", "CUI 3.1.1", "800-171 3.1.1"
function canonical(id: string): string {
  const s = id.toUpperCase().trim();
  // 800-171 numeric id: A.B.C (strip leading zeros on each segment)
  const cui = s.match(/(\d+)\.0*(\d+)\.0*(\d+)/);
  if (cui) return `${+cui[1]}.${+cui[2]}.${+cui[3]}`;
  // 800-53: two family letters, number, optional enhancement in () or .
  const m = s.match(/([A-Z]{2})[-\s]?0*(\d+)(?:\s*[.(]\s*0*(\d+)\s*\)?)?/);
  if (m) return m[3] ? `${m[1]}-${+m[2]}(${+m[3]})` : `${m[1]}-${+m[2]}`;
  return s;
}

const BY_ID = new Map<string, NistControl>();
for (const c of CONTROLS) BY_ID.set(canonical(c.id), c);

function familyMatch(input: string): (c: NistControl) => boolean {
  const q = input.trim().toUpperCase();
  // exact family code (AC, IA, SC, 3.1 ...)
  const codeControls = CONTROLS.filter(c => c.family.toUpperCase() === q);
  if (codeControls.length) return c => c.family.toUpperCase() === q;
  // family title (case-insensitive substring, e.g. "access control")
  const ql = input.trim().toLowerCase();
  return c => c.familyTitle.toLowerCase().includes(ql);
}

function snippet(text: string, len = 240): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len).replace(/\s+\S*$/, '') + '…' : t;
}

// ---- tools ------------------------------------------------------------------
const tools: McpToolExport['tools'] = [
  {
    name: 'nist_control',
    description:
      'Look up the full text of one NIST 800-53 security control or NIST 800-171 CUI security requirement by id — the control statement (requirement prose), discussion/guidance, and related controls. Use for "what does NIST control AC-2 require", "NIST 800-53 AC-2 access control", "FedRAMP control SC-7 boundary protection", "NIST authenticator management IA-5", "NIST CUI control 800-171 3.1.1". Forgiving id: accepts "AC-2", "ac-2", "AC-02", control enhancements "AC-2(1)" or "AC-2.1", and CUI ids "3.1.1" / "3.01.01". Source: SP 800-53 Rev 5 and SP 800-171 Rev 3 (official NIST OSCAL, public domain). Examples: {"id":"AC-2"}, {"id":"SC-7"}, {"id":"IA-5"}, {"id":"AC-2(1)"}, {"id":"3.1.1"}.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description:
            'Control id, e.g. "AC-2", "ac-2", "AC-02", "SC-7", "IA-5", enhancement "AC-2(1)"/"AC-2.1", or CUI requirement "3.1.1".',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'nist_control_search',
    description:
      'Keyword search across NIST 800-53 security/privacy controls and NIST 800-171 CUI requirements by title and requirement text. Use when the id is unknown — "NIST security control for least privilege", "NIST control about session lock", "NIST 800-53 encryption at rest", "NIST cybersecurity control multi-factor authentication", "access control / identification and authentication / system and communications protection". All query tokens must match (case-insensitive AND). Optional family filter (code like "AC", "IA", "SC" or a family name like "access control"). Returns matching {id, family, title, snippet}. Source: SP 800-53 Rev 5 + SP 800-171 Rev 3. Examples: {"query":"least privilege"}, {"query":"multi-factor authentication","family":"IA"}, {"query":"boundary protection"}.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Keywords, e.g. "least privilege" or "encryption at rest". All tokens must match.' },
        family: { type: 'string', description: 'Optional family filter: code ("AC","IA","SC",…) or name ("access control").' },
        limit: { type: 'number', description: 'Max results (default 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'nist_control_family',
    description:
      'List every NIST control in a family — the FedRAMP/800-53 control-family baseline. Use for "list all NIST access control controls", "NIST 800-53 AC family", "what controls are in identification and authentication", "NIST system and communications protection family". Input a family code ("AC", "IA", "SC", "AU", "SI", …) or a family name ("access control"). Returns the family title plus every control id + title (including enhancements). Source: SP 800-53 Rev 5 (+ SP 800-171 Rev 3). Examples: {"family":"AC"}, {"family":"identification and authentication"}, {"family":"SC"}.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        family: { type: 'string', description: 'Family code ("AC","IA","SC",…) or name ("access control").' },
      },
      required: ['family'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'nist_control': {
      const rawId = String(args.id ?? '').trim();
      if (!rawId) throw new Error('id is required');
      const key = canonical(rawId);
      const c = BY_ID.get(key);
      if (!c) {
        // suggest close ids in the same family
        const fam = key.match(/^[A-Z]{2}/)?.[0] ?? key.match(/^\d+\.\d+/)?.[0];
        const suggestions = fam
          ? CONTROLS.filter(x => x.id.toUpperCase().startsWith(fam) || x.family.toUpperCase() === fam)
              .slice(0, 12)
              .map(x => x.id)
          : [];
        return {
          found: false,
          query: rawId,
          message: `No NIST control matched "${rawId}".`,
          suggestions,
        };
      }
      return {
        found: true,
        id: c.id,
        family: c.family,
        family_title: c.familyTitle,
        title: c.title,
        statement: c.statement,
        guidance: c.guidance,
        related: c.related,
        source: c.source,
      };
    }

    case 'nist_control_search': {
      const query = String(args.query ?? '').trim();
      if (!query) throw new Error('query is required');
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const limit = Math.max(1, Math.min(50, Number(args.limit) || 10));
      const famFilter = args.family ? familyMatch(String(args.family)) : null;
      const results: Array<{ id: string; family: string; title: string; snippet: string }> = [];
      for (const c of CONTROLS) {
        if (famFilter && !famFilter(c)) continue;
        const hay = (c.title + ' ' + c.statement).toLowerCase();
        if (tokens.every(t => hay.includes(t))) {
          results.push({ id: c.id, family: c.family, title: c.title, snippet: snippet(c.statement) });
          if (results.length >= limit) break;
        }
      }
      return { query, family: args.family ?? null, count: results.length, results };
    }

    case 'nist_control_family': {
      const input = String(args.family ?? '').trim();
      if (!input) throw new Error('family is required');
      const pred = familyMatch(input);
      const controls = CONTROLS.filter(pred);
      if (!controls.length) {
        return {
          found: false,
          query: input,
          message: `No NIST family matched "${input}".`,
          families: [...new Map(CONTROLS.map(c => [c.family, c.familyTitle])).entries()].map(
            ([code, title]) => ({ code, title }),
          ),
        };
      }
      const familyTitle = controls[0].familyTitle;
      const source = controls[0].source;
      return {
        found: true,
        family: controls[0].family,
        family_title: familyTitle,
        source,
        count: controls.length,
        controls: controls.map(c => ({ id: c.id, title: c.title })),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
