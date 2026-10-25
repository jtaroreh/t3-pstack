# Runtime limits

Pstack supplies agent instructions and T3 delegation. Session-start hooks do not intercept tool calls. Read-only briefs and task notes are workflow conventions, not capability isolation or protected system messages.

Enforced action gates require host code at the tool dispatcher. That code must bind the actual action and its preconditions to an independent verdict, preserve user authorization, and reject changed or stale inputs. Unknown shell effects need inspection. A line-count threshold or regular expression is not a security boundary.

Send a factual acknowledgment before consulting. Run safe inspection while the advisor works when useful. Continue after the advisor result at a message boundary. This mode assumes no support for changing system instructions inside an active generation and promises no latency target.

Provider logs must establish cache hits. Identical text alone does not establish KV reuse across Gemini and a different advisor model or provider. Stable evidence can help repeated calls within each provider's supported caching arrangement. See the [OpenAI caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) and [Claude caching guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

Log probabilities are optional provider data, not calibrated correctness scores. Missing log probabilities do not remove the mode's consultation triggers.

Measure total coordinator, workhorse, advisor, retry, and takeover usage against representative baseline tasks before reporting savings or speedups. Simulated routing tests do not prove production reliability. This mode makes no claim of frontier-equivalent quality or a fixed cost reduction.
