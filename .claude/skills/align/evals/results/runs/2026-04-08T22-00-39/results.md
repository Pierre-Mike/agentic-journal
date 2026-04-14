## align eval — 2026-04-08T22-00-39

**Overall: 93% pass rate** ✓

| Sample | Passed | Total | Rate |
|--------|--------|-------|------|
| 1 | 4 | 4 | 100% ✓ |
| 2 | 5 | 5 | 100% ✓ |
| 3 | 3 | 3 | 100% ✓ |
| 4 | 3 | 3 | 100% ✓ |
| 5 | 3 | 4 | 75% ~ |
| 6 | 3 | 4 | 75% ~ |
| 7 | 4 | 4 | 100% ✓ |

### Failed expectations

**5**: BEFORE presenting the big picture, the assistant performs online research (web search, GitHub search, or both) to inform its proposal — this is evidenced by the assistant explicitly mentioning it researched, looked up, or searched for information about collaborative editing technologies, libraries, or patterns.
> The output contains no explicit mention of research. It jumps directly into the big picture presentation without any statement like 'I searched for...', 'I looked up...', or 'I researched...'. There is no visible research phase before the proposal.

**6**: The assistant performs online research on the WhatsApp Business API — specifically its rate limiting, integration patterns, or best practices — BEFORE re-presenting the corrected big picture. This is evidenced by the assistant explicitly mentioning what it found about WhatsApp API constraints.
> The output presents WhatsApp-specific knowledge (tiered rate limits, 24-hour messaging windows, token bucket throttler) but contains no explicit statement that research was performed, no mention of what was found during research, and no indication that the assistant looked up external information before presenting the corrected big picture. The knowledge is simply incorporated without showing the research step.
