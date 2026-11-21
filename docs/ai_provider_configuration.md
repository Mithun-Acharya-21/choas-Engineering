# AI Provider Configuration & Environment Setup (Milestone M9)

## 1. Configuration Settings

LLM synthesis parameters are configured in `backend/app/core/config.py` via Pydantic BaseSettings:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | `mock` | Active provider: `mock`, `groq`, or `openai` |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Target LLM model name |
| `LLM_TIMEOUT_SECONDS` | `15` | Maximum duration before triggering fallback |
| `LLM_TEMPERATURE` | `0.1` | Sampling temperature (0.0 to 1.0) |
| `LLM_MAX_TOKENS` | `2048` | Maximum output generation token limit |
| `GROQ_API_KEY` | `None` | Authentication key for Groq Cloud API |
| `OPENAI_API_KEY` | `None` | Optional OpenAI key if using OpenAI endpoint |

---

## 2. Production Deployment (Groq Cloud)

To activate Groq in production or staging environments:

1. Obtain a Groq API key from [https://console.groq.com/keys](https://console.groq.com/keys).
2. Set environment variables in your Kubernetes Secret or `.env` file:
   ```bash
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_your_groq_api_key_here
   LLM_MODEL=llama-3.3-70b-versatile
   ```
3. Restart the backend pod or Docker container.

If `GROQ_API_KEY` is omitted or invalid, the backend automatically logs a warning and routes all synthesis through `DeterministicFallbackGenerator` without disrupting platform uptime.
