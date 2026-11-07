# Configuration and model providers

**Jade Vault 2.9.0** · [Documentation index](README-docs.md)

Use Config's search box if a section is not visible in the selected tab. Keep credentials in the designated settings fields, not in chat or notes.

## Provider reference

| Provider | Connection | Notes |
| --- | --- | --- |
| Ollama | Host of an Ollama server, commonly `http://localhost:11434` on the same computer | Client uses `/api/tags` and `/api/chat` |
| Ollama Cloud | Cloud configuration plus API key | Sends model requests off-device |
| Groq | Groq API key | OpenAI-style chat API; model/tool capabilities vary |
| OpenRouter | OpenRouter API key (`sk-or-…`) | Hundreds of hosted models behind one key, billed per token; the model list shows only models that can call tools; model ids look like `anthropic/claude-sonnet-4.5` |
| llama.cpp | Running server, commonly port 8080 | Client normalizes its base to `/v1` |
| OpenAI-compatible | API base URL and optional bearer key | Base should include the provider's API prefix, commonly `/v1`; client appends `/models` and `/chat/completions` |
| AICord | AICord key and character selection | Non-streaming character replies; no tool calling; model list represents characters |

Endpoint defaults are examples, not a network configuration. In particular, `localhost` on an Android phone is the phone, not your laptop.

## Connect to Ollama on another machine

1. Install and start Ollama on the machine that will run the model, and download a suitable model there.
2. Configure the server to listen on an interface reachable by the phone/browser. Limit access with the host firewall and a trusted network.
3. Browser variant only: configure allowed browser origins on the model server as necessary (for Ollama, `OLLAMA_ORIGINS`). The Android app sends its requests natively (Rust, outside the WebView), so it needs no allowed origins; the server only has to listen on an address the phone can reach (for Ollama, `OLLAMA_HOST=0.0.0.0`).
4. Enter the computer's LAN or private-VPN address in Jade Vault, for example `http://192.168.1.20:11434`.
5. Connect and select the model. Test simple chat, then a note-search request.

Do not expose an unauthenticated model endpoint to the public internet. An HTTPS-hosted browser app may refuse requests to a plain HTTP endpoint as mixed content. Use a correctly secured reachable endpoint or a suitable local deployment; disabling browser security is not a deployment strategy.

## Fallbacks and model capabilities

The configured primary provider is tried first, then the fallback providers in order. Jade remembers model selections per provider and can switch after connection/run failures. It checks for recovery of the primary before later prompts.

- Configure credentials and a working model for every fallback.
- Review data policy and cost for **every** provider in the chain: failover can send context to a different service.
- Tool calling, image input, output quality, and context size depend on the selected model/provider.
- Context guard can compact or trim history and learn limits; it does not make a small model's context unlimited.

## Decisions on Ollama Cloud

Choose **Ollama Cloud** under Config → Decision models → Server to run decisions on ollama.com (`POST https://ollama.com/v1/systemone`, per [Ollama's System One docs](https://docs.ollama.com/api/systemone)). It uses the Ollama Cloud key from Model provider; a key typed in the Decision models key field wins. **Scan** lists the decision models your key can use (today Ollama documents `clef`; a name typed with `:cloud`, the local-server form, is sent as `clef`). Cloud decision models need a paid Ollama plan or usage credits. `decide`, `jade.decide()`, flow Decide steps and the model router all go there.

Ollama's decision API differs from Ollaya's in its wire format: a choice question's options are named keys, the answer names the winning key, and a yes/no answer is the probability of true. Jade translates both ways, for local Ollama (0.35+) too, so answers look the same whichever server you use.

## Fallback providers

Under Config → Model provider → **If it fails, try these in order**, tick any provider (OpenRouter included) and order them with the arrows. A ticked provider without its key says **needs key** and shows its key field; the mark clears once the key is typed.

## Searching model lists

Model dropdowns with more than eight entries (the header, Model provider, heartbeat, compaction and decision models) open a searchable list: type words in any order to narrow it, tap one to choose it, or **Use** a name that is not listed. Enter picks the only match; Escape closes it.

## Jade's gemstone themes

Open Config → App → Jade companion, or click the gemstone label above the avatar. Choose from ten gemstone palettes—Jade, Ruby, Amethyst, Gold, Sapphire, Diamond, Rose Gold, Emerald, Obsidian, and Quartz—or use **Spectrum** to pick any accent color. **Custom Gradient** lets you choose two colors and a vertical, horizontal, or diagonal blend. Themes recolor Jade's green accents and coordinate the app highlights.

Under **Customize Jade's appearance**, hair, clothes, stockings, and boots can each keep their original colors, use a Spectrum color, or use an independent two-color gradient. Skin offers natural tones (Porcelain, Fair, Light, Medium, Tan, and Deep), Spectrum color picking, or a gradient. The color changes preserve shading and texture detail. Each selection is saved with app settings.

## Other model settings

Choose context and generation settings conservatively for your model and hardware. Decision models (Ollaya, Ollama 0.35+, or Ollama Cloud; Config → Decision models → Server) are a separate classification/decision capability used by `jade.decide()` and flow Decide steps; configure that service before relying on them. Heartbeat can use its own provider/model settings. A separate compaction model can also be selected; choose one suitable for summarizing the same private context as the chat model.

## Credentials and secrets

- Provider keys belong in their provider fields.
- HTTP tool secrets belong in Config's Secrets section and use `{{NAME}}` placeholders.
- MCP header values can use `${NAME}` from MCP secrets.
- Vector and Discord each use a separate bridge bearer token. Discord's bot token belongs only on the bridge host; see [Discord setup](discord.md).
- The Android API uses its own inbound token; do not reuse provider or bridge keys.

Secrets are stored in app storage, not an OS-wide credential vault. Read [security](security-and-privacy.md) and [backup coverage](backup-and-storage.md) before sharing an export.

Implementation: [providers.js](../app/modules/providers.js), [net.js](../app/modules/net.js), and configuration assembly in [build.py](../app/build.py).
