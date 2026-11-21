# LLM Architecture & Orchestration (Milestone M9)

## 1. Overview

The ChaosEngine AI LLM layer orchestrates structured communication between backend telemetry databases and modern large language models. The architecture provides:

- **Pluggable Providers**: Interface-based design supporting `MockLLMProvider` (local deterministic development & CI/CD) and `GroqLLMProvider` (production inference via `llama-3.3-70b-versatile`).
- **Strict Output Schema Enforcement**: Forces JSON Object response format and validates all outputs against Pydantic domain models.
- **Fail-Safe Fallback**: Transparently switches to algorithmic template generation upon network partition or provider degradation.

---

## 2. Interface Definition

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        """Synchronously invokes the LLM with prompt and system instructions."""
        pass
```

### 2.1 Groq Production Provider

The `GroqLLMProvider` connects to `https://api.groq.com/openai/v1/chat/completions` using `httpx`.
- **Model**: `llama-3.3-70b-versatile`
- **Response Format**: `{"type": "json_object"}`
- **Temperature**: `0.1` (low temperature minimizes generative drift and maximizes structural fidelity)
- **Max Tokens**: `2048`
- **Timeout**: `15` seconds

### 2.2 Mock Testing Provider

The `MockLLMProvider` executes deterministic pattern extraction from prompt context:
- Discovers the authoritative M8 primary root cause and available evidence IDs.
- Assembles rich executive summaries, technical narratives, and multi-priority remediation recommendations.
- Guarantees zero external network dependencies, ensuring 100% test reproducibility in sandboxed environments.

---

## 3. Fallback Synthesizer Architecture

When the active provider raises an exception (`httpx.TimeoutException`, `httpx.HTTPStatusError`, invalid JSON output), `LLMSynthesisService` triggers `DeterministicFallbackGenerator`:

```python
try:
    raw_output = provider.generate(prompt=prompt, system_prompt=self.SYSTEM_PROMPT)
    # validate and verify
except Exception:
    fallback = DeterministicFallbackGenerator.generate(analysis, incident_metadata)
    return fallback
```

The fallback generator extracts the primary root cause and evidence items directly from mathematical factor analysis and outputs an `AIIncidentExplanation` with `status="FALLBACK_GENERATED"` and `is_deterministic_fallback=True`.
