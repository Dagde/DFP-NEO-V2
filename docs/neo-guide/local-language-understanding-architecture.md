# NEO Guide Local Language Understanding Architecture

Status: design gate, not yet production integrated.

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

