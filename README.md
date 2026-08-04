# mcp-nist-standards

NIST Standards MCP pack

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `nist_control` | Look up the full text of one NIST 800-53 security control or NIST 800-171 CUI security requirement by id — the control statement (requirement prose), discussion/guidance, and related controls. Use for "what does NIST control AC-2 require", "NIST 800-53 AC-2 access control", "FedRAMP control SC-7 boundary protection", "NIST authenticator management IA-5", "NIST CUI control 800-171 3.1.1". Forgiving id: accepts "AC-2", "ac-2", "AC-02", control enhancements "AC-2(1)" or "AC-2.1", and CUI ids "3.1.1" / "3.01.01". Source: SP 800-53 Rev 5 and SP 800-171 Rev 3 (official NIST OSCAL, public domain). Examples: {"id":"AC-2"}, {"id":"SC-7"}, {"id":"IA-5"}, {"id":"AC-2(1)"}, {"id":"3.1.1"}. |
| `nist_control_search` | Keyword search across NIST 800-53 security/privacy controls and NIST 800-171 CUI requirements by title and requirement text. Use when the id is unknown — "NIST security control for least privilege", "NIST control about session lock", "NIST 800-53 encryption at rest", "NIST cybersecurity control multi-factor authentication", "access control / identification and authentication / system and communications protection". All query tokens must match (case-insensitive AND). Optional family filter (code like "AC", "IA", "SC" or a family name like "access control"). Returns matching {id, family, title, snippet}. Source: SP 800-53 Rev 5 + SP 800-171 Rev 3. Examples: {"query":"least privilege"}, {"query":"multi-factor authentication","family":"IA"}, {"query":"boundary protection"}. |
| `nist_control_family` | List every NIST control in a family — the FedRAMP/800-53 control-family baseline. Use for "list all NIST access control controls", "NIST 800-53 AC family", "what controls are in identification and authentication", "NIST system and communications protection family". Input a family code ("AC", "IA", "SC", "AU", "SI", …) or a family name ("access control"). Returns the family title plus every control id + title (including enhancements). Source: SP 800-53 Rev 5 (+ SP 800-171 Rev 3). Examples: {"family":"AC"}, {"family":"identification and authentication"}, {"family":"SC"}. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "nist-standards": {
      "url": "https://gateway.pipeworx.io/nist-standards/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Nist Standards data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
