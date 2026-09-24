# NEO Guide - Third-Party Model and Software Licensing

Status: preliminary due-diligence record. DFP-NEO includes optional local-language service plumbing, but no local language model, embedding model, vector index library or inference runtime listed below has been bundled or approved for production DFP-NEO by this record alone.

## Commercial Transfer Test

Question: If DFP-NEO is sold tomorrow to a large multinational commercial or Defence company, can that company continue to use, modify, deploy, redistribute and commercially sell DFP-NEO containing these components without purchasing a separate commercial licence from the model/dependency developer?

Current answer: Not yet applicable. No model/runtime has been embedded. Every candidate below remains subject to exact artefact verification before customer packaging or production integration.

## Selection Rule

Prefer Apache License 2.0. A candidate must be rejected or sent for legal review if the exact model weights, quantisation file, runtime or dependency include non-commercial, research-only, evaluation-only, revenue-threshold, company-size, MAU, redistribution, remote-service or ownership-transfer restrictions.

## Preferred Candidate

Granite 4.2 8B is the preferred language-understanding and response-generation candidate for NEO Guide, subject to exact model artefact and quantisation verification before integration.

Reasons:

- IBM Granite 4.2 language-model project states that all Granite 4.2 language models are distributed under Apache 2.0.
- IBM's Granite product page describes Granite as open source under Apache 2.0.
- IBM provides an official `ibm-granite/granite-4.2-8b-GGUF` repository for quantised local-runtime evaluation and references the base model card.
- Granite is positioned for enterprise workloads, which better matches DFP-NEO's commercial and Defence deployment assumptions than community or research-only models.

Open checks before integration:

- Copy and preserve the exact Apache 2.0 licence file from the selected base-model repository.
- Copy and preserve any NOTICE/disclosure files required by the selected base model and selected GGUF artefact.
- Verify the exact quantisation file used for evaluation, for example `ibm-granite/granite-4.2-8b-GGUF:Q4_K_M`.
- Verify the selected inference runtime licence at the exact commit/build used.
- Verify that redistribution of the selected model-weight artefact with DFP-NEO is permitted and operationally practical.
- Decide whether model/runtime artefacts are bundled with DFP-NEO, supplied as a separate customer-controlled deployment package, or installed by the hosting environment.

## Candidate Records

### Component: IBM Granite 4.2 8B

Version: `ibm-granite/granite-4.2-8b`
Developer: IBM Granite
Purpose: Preferred candidate local language-understanding and response-generation model.
Official source: https://huggingface.co/ibm-granite/granite-4.2-8b
Licence: Apache-2.0 according to IBM Granite 4.2 language-model project and IBM Granite product information.
Licence URL/file: Candidate repository licence file must be copied and reviewed before integration.
Commercial use permitted: Preliminary yes, subject to exact file verification.
Modification permitted: Preliminary yes, subject to exact file verification.
Redistribution permitted: Preliminary yes, subject to exact file verification.
Model-weight redistribution permitted: Preliminary yes, subject to exact file verification.
Enterprise deployment permitted: Preliminary yes, subject to exact file verification.
Government/Defence deployment restriction: None identified in preliminary IBM/Hugging Face/GitHub materials.
Revenue/company-size restriction: None identified in preliminary IBM/Hugging Face/GitHub materials.
Attribution requirement: Apache-2.0 notice obligations apply.
NOTICE requirement: Check candidate repository before integration.
Source-code requirement: None identified for Apache-2.0.
Network requirement: None for local model use once artefacts are installed.
Other obligations: Preserve licence, notices and IBM model/disclosure files.
Date licence checked: 2026-09-24.
Integration status: Preferred candidate only, not integrated.

### Component: IBM Granite 4.2 8B GGUF

Version: `ibm-granite/granite-4.2-8b-GGUF`, likely initial evaluation quantisation `Q4_K_M`
Developer: IBM Granite
Purpose: Preferred candidate quantised local-runtime artefact for CPU/local inference evaluation.
Official source: https://huggingface.co/ibm-granite/granite-4.2-8b-GGUF
Licence: Must inherit/align with the base Granite 4.2 8B licence; exact repository licence and files must be checked before integration.
Licence URL/file: Candidate repository licence file must be copied and reviewed before integration.
Commercial use permitted: Preliminary yes via base-model Apache-2.0 position, subject to exact GGUF file verification.
Modification permitted: Preliminary yes, subject to exact GGUF file verification.
Redistribution permitted: Preliminary yes, subject to exact GGUF file verification.
Model-weight redistribution permitted: Preliminary yes, subject to exact GGUF file verification.
Enterprise deployment permitted: Preliminary yes, subject to exact GGUF file verification.
Government/Defence deployment restriction: None identified in preliminary materials.
Revenue/company-size restriction: None identified in preliminary materials.
Attribution requirement: Apache-2.0 notice obligations apply.
NOTICE requirement: Check candidate repository before integration.
Source-code requirement: None identified for Apache-2.0.
Network requirement: None for local model use once artefacts are installed.
Other obligations: Preserve licence, notices, model card/disclosure references and quantisation provenance.
Date licence checked: 2026-09-24.
Integration status: Preferred quantised candidate only, not integrated.

### Component: IBM Granite 3.3 8B Instruct

Version: `ibm-granite/granite-3.3-8b-instruct`
Developer: IBM Granite
Purpose: Fallback candidate local language-understanding and response-generation model.
Official source: https://huggingface.co/ibm-granite/granite-3.3-8b-instruct
Licence: Apache-2.0 according to Hugging Face repository metadata.
Licence URL/file: Candidate repository licence file must be copied and reviewed before integration.
Commercial use permitted: Preliminary yes, subject to exact file verification.
Modification permitted: Preliminary yes, subject to exact file verification.
Redistribution permitted: Preliminary yes, subject to exact file verification.
Model-weight redistribution permitted: Preliminary yes, subject to exact file verification.
Enterprise deployment permitted: Preliminary yes, subject to exact file verification.
Government/Defence deployment restriction: None identified in preliminary metadata.
Revenue/company-size restriction: None identified in preliminary metadata.
Attribution requirement: Apache-2.0 notice obligations apply.
NOTICE requirement: Check candidate repository before integration.
Source-code requirement: None identified for Apache-2.0.
Network requirement: None for local model use once artefacts are installed.
Other obligations: Preserve licence and notices.
Date licence checked: 2026-09-24.
Integration status: Candidate only, not integrated.

### Component: Mistral 7B Instruct v0.3

Version: `mistralai/Mistral-7B-Instruct-v0.3`
Developer: Mistral AI
Purpose: Candidate local language-understanding and response-generation model.
Official source: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3
Licence: Apache-2.0 according to Hugging Face repository metadata and Mistral documentation for v0.3.
Licence URL/file: Candidate repository licence file must be copied and reviewed before integration.
Commercial use permitted: Preliminary yes, subject to exact file verification.
Modification permitted: Preliminary yes, subject to exact file verification.
Redistribution permitted: Preliminary yes, subject to exact file verification.
Model-weight redistribution permitted: Preliminary yes, subject to exact file verification.
Enterprise deployment permitted: Preliminary yes, subject to exact file verification.
Government/Defence deployment restriction: None identified in preliminary metadata.
Revenue/company-size restriction: None identified in preliminary metadata.
Attribution requirement: Apache-2.0 notice obligations apply.
NOTICE requirement: Check candidate repository before integration.
Source-code requirement: None identified for Apache-2.0.
Network requirement: None for local model use once artefacts are installed.
Other obligations: Preserve licence and notices.
Date licence checked: 2026-09-24.
Integration status: Candidate only, not integrated.

### Component: sentence-transformers/all-MiniLM-L6-v2

Version: `sentence-transformers/all-MiniLM-L6-v2`
Developer: Sentence Transformers
Purpose: Candidate local embedding model for semantic retrieval.
Official source: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
Licence: Apache-2.0 according to Hugging Face repository metadata.
Licence URL/file: Candidate repository licence file must be copied and reviewed before integration.
Commercial use permitted: Preliminary yes, subject to exact file verification.
Modification permitted: Preliminary yes, subject to exact file verification.
Redistribution permitted: Preliminary yes, subject to exact file verification.
Model-weight redistribution permitted: Preliminary yes, subject to exact file verification.
Enterprise deployment permitted: Preliminary yes, subject to exact file verification.
Government/Defence deployment restriction: None identified in preliminary metadata.
Revenue/company-size restriction: None identified in preliminary metadata.
Attribution requirement: Apache-2.0 notice obligations apply.
NOTICE requirement: Check candidate repository before integration.
Source-code requirement: None identified for Apache-2.0.
Network requirement: None for local model use once artefacts are installed.
Other obligations: Preserve licence and notices.
Date licence checked: 2026-09-24.
Integration status: Candidate only, not integrated.

### Component: llama.cpp

Version: Not selected.
Developer: llama.cpp project.
Purpose: Candidate local inference runtime.
Official source: https://github.com/ggml-org/llama.cpp
Licence: Candidate runtime licence must be checked against the exact commit before integration.
Licence URL/file: Candidate repository licence file must be copied and reviewed before integration.
Commercial use permitted: Requires exact commit verification.
Modification permitted: Requires exact commit verification.
Redistribution permitted: Requires exact commit verification.
Model-weight redistribution permitted: Not applicable to runtime; model weights are separately licensed.
Enterprise deployment permitted: Requires exact commit verification.
Government/Defence deployment restriction: Requires exact commit verification.
Revenue/company-size restriction: Requires exact commit verification.
Attribution requirement: Depends on exact licence file.
NOTICE requirement: Depends on exact licence file.
Source-code requirement: Depends on exact licence file.
Network requirement: None expected for local runtime after installation.
Other obligations: Runtime licence and bundled dependencies must be reviewed.
Date licence checked: 2026-09-24 preliminary source identified only.
Integration status: Candidate only, not integrated.

## Rejected-by-Default Categories

- Llama-family or Gemma-family models unless the exact licence passes this record and legal review.
- Any model with a provider-specific community licence containing revenue, MAU, company-size, ownership-transfer or redistribution restrictions.
- Any model requiring cloud inference or provider telemetry.
- Any model where the exact quantised weights have unclear provenance or licence.
