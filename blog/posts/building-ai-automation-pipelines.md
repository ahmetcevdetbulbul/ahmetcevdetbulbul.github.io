## The gap between a demo and a pipeline

A working AI demo is easy: call an API, print the response. A pipeline that runs
unattended in production for months is a different problem entirely. The gap between
the two is where most of the interesting engineering work actually happens.

Over the last few automation projects I've built, the same handful of concerns keep
showing up regardless of the domain — customer support triage, document processing,
internal tooling. Here's what I've learned to treat as first-class requirements
instead of afterthoughts.

## Design prompts like public APIs

A prompt template is a contract. If you change the wording six months from now and
don't test against your existing examples, you will silently break behavior that
downstream systems depend on. I keep a small set of golden input/output examples per
prompt and re-run them whenever the template changes — the same discipline as a
regression test suite, just aimed at natural language instead of code.

## Assume the model will fail differently than you expect

Traditional error handling assumes failures are exceptions: a thrown error, a non-200
status code. LLM failures are often silent — a malformed JSON response, a
hallucinated field, a confidently wrong classification. That means validation has to
happen *after* a successful call, not just around it:

- Validate structure (does the JSON parse, are required fields present)
- Validate plausibility (is this value in a sane range, does this category exist)
- Have a fallback path for when validation fails, not just a retry

## Monitoring is the difference between "it works" and "it's still working"

Once a pipeline is live, the important question shifts from "does it work" to "is it
still working, and how well." I log every model call with its inputs, outputs, and
validation result, and track drift over time — if the rate of fallback-path
triggers creeps up, that's a signal the model, the input distribution, or an upstream
API has changed before anyone notices in a bug report.

## The takeaway

None of this is unique to AI systems — it's the same rigor you'd want in any
production system. The difference is that with LLMs, the failure modes are less
familiar, so it's easy to skip the parts of the engineering discipline that don't
have an obvious analog yet. Treating prompts as versioned contracts and model output
as untrusted input until proven otherwise has been the highest-leverage habit in
making these systems boring — in the best sense of the word.
