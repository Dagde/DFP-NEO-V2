# NEO Guide Local Language Understanding Architecture

Status: optional local interpreter service scaffold implemented; model weights and runtime are not bundled.

## Objective

NEO Guide needs a stronger local language-understanding layer while keeping the existing DFP-NEO knowledge model, deterministic reasoning, navigation targets, permissions and live-data checks as the source of truth.

The local model must not become the authority for DFP-NEO behaviour. It may interpret the user's question and turn verified facts into plain English. DFP-NEO must still decide what is true.

## Required Flow

```text
User question
  -> local language interpretation
  -> hybrid retrieval
  -> DFP-NEO knowledge model
  -> permitted live DFP-NEO data
  -> deterministic reasoning
  -> verified fact pack
  -> local response generation
  -> verified navigation actions
```

## Hard Rules

- No external inference API.
- No external embedding API.
- No runtime model download.
- No external vector database.
- No telemetry containing user questions or DFP-NEO data.
- No model-generated SQL, JavaScript, shell commands, arbitrary URLs or database writes.
- No model or runtime may be added until the exact component and exact model weights have passed the licensing record in `third-party-model-and-software-licensing.md`.

## Intended Implementation Phases

1. Expand the NEO Guide evaluation set with real DFP-NEO questions, including badly written, indirect and contextual questions.
2. Add a local semantic index over the existing knowledge model.
3. Add a local interpreter interface that returns structured intent/entities only.
4. Add deterministic fact-pack generation from the existing Guide/reasoning layer.
5. Add local response generation that is constrained to the fact pack.
6. Add offline acceptance testing.

## Current Risk

The current deterministic keyword/scoring layer can still misread a user's action even when the relevant topic is present. For example, "delete a staff member" must not resolve to "staff unavailability". This has been addressed for the observed case, but the broader solution requires a semantic interpreter and a much larger evaluation set.

## Preferred Model Direction

Preferred language model candidate: IBM Granite 4.2 8B.

Preferred first local-runtime artefact for evaluation: IBM Granite 4.2 8B GGUF, likely `Q4_K_M`, subject to exact licence and artefact verification.

This preference does not integrate model weights yet. The next implementation step is to pin the exact model artefact, copy required licence/notice files, and run the NEO Guide language evaluation set locally.

## Performance Policy

The local language layer must be optional, lazy and time-boxed.

- DFP-NEO must start and run without the local model service.
- The browser must never load model weights.
- The main application must not wait for Granite during startup.
- NEO Guide must answer immediately using the deterministic guide.
- Local language interpretation is used only when configured and when the deterministic answer is low-confidence, ambiguous or explicitly asks for clarification.
- Local interpretation requests must have a short timeout.
- If the local service is unavailable, slow or returns invalid data, NEO Guide silently keeps the deterministic answer.
- The local model service must run out-of-process from the main application.

## Implemented Optional Service Boundary

DFP-NEO now includes a small optional sidecar service:

```text
Browser NEO Guide panel
  -> deterministic DFP-NEO guide answer
  -> optional POST to local sidecar when the deterministic answer is weak
  -> sidecar calls localhost model runtime
  -> sidecar returns structured interpretation JSON only
  -> browser re-runs deterministic DFP-NEO guide against the interpreted question
```

The sidecar does not answer questions directly and does not become the authority for DFP-NEO behaviour. It only returns a structured interpretation:

```json
{
  "confidence": 0.0,
  "rewrittenQuestion": "",
  "intent": "",
  "concepts": [],
  "entities": {},
  "clarificationQuestion": "",
  "requiresLiveData": false
}
```

The browser client ignores the sidecar if it is not configured, slow, unavailable or returns invalid data. The deterministic Guide remains the fallback.

## Runtime Configuration

Start the sidecar:

```bash
npm run neo-guide:local-language-service
```

Expected local model runtime:

- Default endpoint: `http://127.0.0.1:8080/v1/chat/completions`
- Expected API shape: OpenAI-compatible chat completions
- Preferred model name: `granite-4.2-8b`
- Recommended runtime candidate: `llama.cpp` or equivalent localhost-only OpenAI-compatible runtime, subject to licensing review

Useful environment variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEO_GUIDE_SERVICE_HOST` | Sidecar bind address | `127.0.0.1` |
| `NEO_GUIDE_SERVICE_PORT` | Sidecar port | `8765` |
| `NEO_GUIDE_LLAMACPP_URL` | Local model chat-completions URL | `http://127.0.0.1:8080/v1/chat/completions` |
| `NEO_GUIDE_MODEL_NAME` | Model name sent to the local runtime | `granite-4.2-8b` |
| `NEO_GUIDE_INFERENCE_TIMEOUT_MS` | Sidecar-to-model timeout, capped at 8000 ms | `1800` |
| `NEO_GUIDE_ALLOWED_ORIGIN` | Production app origin allowed to call the sidecar | unset |
| `NEO_GUIDE_ALLOW_NONLOCAL_MODEL` | Explicit override for non-local model URL | unset |

Configure the browser app to call the sidecar:

```bash
VITE_NEO_GUIDE_LOCAL_LANGUAGE_URL=http://127.0.0.1:8765/interpret
VITE_NEO_GUIDE_LOCAL_LANGUAGE_TIMEOUT_MS=1200
```

Production or Defence deployments should set `NEO_GUIDE_ALLOWED_ORIGIN` to the exact DFP-NEO origin and should keep `NEO_GUIDE_LLAMACPP_URL` on localhost or an approved private-network inference endpoint.

## Current Limits

- No model weights are stored in this repository.
- No inference runtime is bundled in this repository.
- No semantic vector index is implemented yet.
- The service improves question interpretation only; verified DFP-NEO answers still come from the deterministic knowledge model and permitted live-data checks.
- Exact Granite artefacts, runtime build and licences must be pinned before packaging this as a customer-deliverable capability.
