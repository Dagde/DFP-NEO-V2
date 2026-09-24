# NEO Guide - Third-Party Model and Software Licensing

Status: no third-party language model, embedding model, vector database or inference runtime is selected for NEO Guide integration.

## Current Product Decision

NEO Guide uses lightweight deterministic intent matching over DFP-NEO's own knowledge model. The current approved direction is to avoid bundled language models because model files would materially increase the application footprint.

## Commercial Transfer Position

No model-weight licence is currently required for NEO Guide because no model weights are bundled, downloaded or called by the application.

If a future version reconsiders model use, the selected model, quantisation artefact, runtime and transitive dependencies must be reviewed before integration.

## Rejected Current Approach

The previous optional local-language-service approach has been removed from active code. Granite, Qwen or any other model candidate must not be added unless a new product decision explicitly approves the size, runtime and licensing implications.

## Future Selection Rule

If a future model path is reopened, prefer Apache License 2.0 and reject or send for legal review any candidate with non-commercial, research-only, evaluation-only, revenue-threshold, company-size, MAU, redistribution, remote-service or ownership-transfer restrictions.

The exact artefact must be reviewed, not only the model family name.
