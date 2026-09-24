# NEO Guide Lightweight Intent Matching Architecture

Status: implemented baseline; ongoing intent-library expansion required.

## Objective

NEO Guide must remain small, fast, deterministic and fully offline. It must not require or bundle a local language model, model weights, external inference service, cloud chatbot or runtime model download.

The Guide's job is to determine which known DFP-NEO function, workflow or question the user is most likely asking about, then answer from verified DFP-NEO knowledge.

## Implemented Flow

```text
User question
  -> normalise wording
  -> expand known DFP-NEO synonyms and database vocabulary
  -> score against curated and audited DFP-NEO functions
  -> apply action-word, question-type, page-context and conversation-context weighting
  -> answer directly when confidence is sufficient
  -> otherwise use staged clickable clarification
  -> answer selected intent from verified knowledge
```

## No Model Policy

Do not introduce:

- bundled LLMs;
- local inference engines;
- external language APIs;
- embedding models;
- large vector databases;
- runtime model downloads.

The accepted product direction is a compact structured intent library and deterministic matcher.

## Intent Library Source

The base intent library is built from:

- curated NEO Guide functions;
- generated DFP-NEO audit records;
- application terminology;
- customer database vocabulary when `DATABASE_URL` is available during `neo-guide:db-vocabulary`.

The canonical answer remains controlled by DFP-NEO development. User interactions may improve wording-to-intent matching, but cannot rewrite business rules, procedures or verified answers.

## Matching Signals

The matcher uses:

- exact phrase matches;
- exact token matches;
- synonyms and aliases;
- action-family weighting, such as add, edit, archive, delete and unavailable;
- question type detection, such as where, how, what and why;
- fuzzy near-token matching;
- DFP-NEO terminology from the codebase and safe database vocabulary;
- current page context;
- selected record context;
- previous conversation topic for referential follow-ups;
- local learned associations from prior clicked clarification choices.

Negative/action words are weighted heavily so that questions such as "delete staff" do not resolve to "staff unavailability" merely because both contain "staff".

## Three-Stage Clarification

When confidence is insufficient, NEO Guide now uses a staged clickable resolution process:

1. Stage 1: show the five strongest candidate intents.
2. Stage 2: if the user selects "None of these", show up to five different alternatives that were not already shown.
3. Stage 3: if still rejected, show up to five broader alternatives.
4. After Stage 3: ask the user to rephrase and start a fresh search cycle.

Selecting a displayed option immediately confirms that intent and returns its verified answer. It does not perform another interpretation search.

## Local Learned Associations

When a user selects a clarification option, the browser stores the normalised wording and selected intent in local storage under:

```text
dfp-neo-guide-learned-associations.v1
```

This improves future matching on that browser. It is intentionally limited to wording associations. It does not modify the base knowledge model.

## Footprint

This architecture adds only TypeScript code and compact structured data. It is intended to keep added footprint in the low single-digit megabytes rather than hundreds of megabytes.

The production build should be measured after intent-library expansion with:

```bash
npm run build
du -sh dfp-neo-platform/public/flight-school-app
du -sh dfp-neo-platform/public/flight-school-app/assets
```
