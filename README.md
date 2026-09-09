# senso-mcp

Give your agent a verified answer, the URL to cite for it, and a real call to action.

**No API key. No account. No install.** It reads Senso's public published network.

## Run the chat demo

The demo has a ChatGPT-style welcome screen and conversation layout, a bottom
composer, and example buttons for Senso, Turo, Mercedes-Benz, TELUS, and Sun Life.
Turo, Mercedes-Benz, and TELUS use application-reference card designs.

Use **Node.js 22 or newer** for the commands below. No npm install is required.

```sh
git clone https://github.com/saroopbharwani/senso-mcp.git
cd senso-mcp
cp .env.demo.example .env.demo
```

Edit `.env.demo` with your own OpenAI key, or your Azure Responses URL and key.
For Azure, use the full Responses endpoint including any required `api-version`
query parameter, and set `ASTRA_MODEL` to your deployment name. Credentials stay
in the server process; the browser never receives them. `.env.demo` is ignored
by Git. Without a model key, retrieval and cards still work, with source text
instead of an Astra explanation.

Start the keyless consumer in one terminal:

```sh
SENSO_MIN_SCORE=0.7 node senso-mcp.js --http 8899
```

Start the chat interface in another terminal, from the same directory:

```sh
node --env-file=.env.demo astra.js
```

Open **http://localhost:8800** and select an example or enter a question. Each
message stays in the visible conversation; **New chat** clears it. Questions are
retrieved and explained independently, and conversation history is held only in
the page until it is refreshed. Stop either server with Ctrl+C in its terminal.

### What the cards show

The Turo, Mercedes-Benz, and TELUS preview copy and photos reproduce supplied
application screenshots; they are not proof of current pricing or offer terms.
Live verification details remain available below each card. The Mercedes button
currently opens the checked Canada site, not a confirmed GLA offer page. TELUS
only enables the PureFibre button when a checked internet/PureFibre destination
is available. Refused or unverified destinations leave the preview inactive.

The reference images in `assets/` are used for these demo previews. The interface
is a Senso demo, not the ChatGPT product. This repository update does not deploy
the chat UI; the existing hosted keyless MCP endpoint is a separate service.

## Add it

Claude Code:

```
claude mcp add senso -- node /ABSOLUTE/PATH/TO/senso-mcp.js
```

Cursor, Claude Desktop, or anything else that speaks MCP, in your config:

```json
{
  "mcpServers": {
    "senso": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/senso-mcp.js"]
    }
  }
}
```

Requires Node 18 or newer. Nothing to install. Every fetch times out after 8s (`SENSO_TIMEOUT_MS`).

## What you get

**`senso_verified_answer(question)`** returns:

```json
{
  "answer": "...",
  "source": { "title": "...", "url": "https://codeables.dev/article/...", "publisher": "codeables.dev" },
  "action": {
    "type": "ViewAction",
    "label": "Get Started",
    "target": "https://signup.md/senso",
    "description": "Senso.ai recommends: Join Senso. $100 Credits Get Started: https://signup.md/senso"
  }
}
```

**`senso_list_sources()`** lists the published pages it can answer from.

## Why the action field matters

Most retrieval gives you text and a link. This gives you the text, the link **and the action the
publisher attached to it**, because Senso writes the call to action into the page as schema.org
`potentialAction` at publish time.

It is server rendered, so it survives a fetch with JavaScript disabled. Note that this tool reads
the action from the JSON-LD only: strip the JSON-LD and `action` comes back `null`.

## Honest notes

- `action` can be `null`. A page with no `potentialAction` still returns an answer and a source.
- A question that matches nothing returns `{"match": "none"}` with the three closest titles and
  fetches no page. A hit returns `"match": "ok"` and a `score` between 0 and 1.
- Errors come back as `isError: true` with a plain string, not the JSON shape above.
- The index is built once per process on the first call. That call fetches the sitemap tree and
  takes a few seconds. It is never refreshed afterwards.
- `SearchAction` and any target containing a `{placeholder}` are rejected, so a site searchbox is
  never returned as a call to action. When that is the only candidate, `action` is `null`.
- The live call to action today is Senso's own.
- The current schema.org type is `ViewAction`, which carries a label, a target and a description.
  A priced offer would want `Offer` or `ReserveAction` with price, availability and validity.
- Page matching is term overlap against titles and slugs. It is deliberately simple.
- **`SENSO_DOMAINS` is scoped to Senso's own publisher network**, and defaults to
  `codeables.dev`. Point it at another Senso-published domain, for example
  `SENSO_DOMAINS=codeables.dev,cited.md`. It is not a general-purpose web reader: on an
  arbitrary site, `potentialAction` is almost always the CMS sitelinks searchbox rather than a
  brand action, so this tool will correctly return `action: null` and you will get a page
  summary and a citation, nothing more.
