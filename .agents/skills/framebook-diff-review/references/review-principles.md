# Review Principles

Use this reference only when calibrating the review or explaining the rationale behind the checklist.

## Source-Inspired Heuristics

- Google Engineering Practices emphasizes design, functionality, complexity, tests, naming, comments, style, documentation, every reviewed line, and broader system context.
- GitLab review guidance frames review as a process for effective, understandable, maintainable, and secure code, with domain-specific reviewers for touched areas.
- CodeRabbit's review model highlights context-rich review: bug detection, security insights, improvement suggestions, summaries, CI/CD analysis, path-based instructions, code guidelines, and project knowledge.
- SWE-PRBench warns that diff-only AI review misses many issues and that unstructured excess context can dilute attention. Prefer compact context: project intent, changed files, direct call sites, contracts, and tests.

## Practical Translation For Framebook

- Start with Framebook's intent and package boundaries before judging changed lines.
- Review exact changed lines, then inspect the smallest surrounding code needed to prove or disprove risk.
- Treat shared contracts as high-risk because client and server both consume them.
- Treat existing generated-image metadata compatibility as high-risk because older records may lack newly introduced fields.
- Treat dead code as a real category: unused exports, stale imports, abandoned config, removed routes still referenced, tests that no longer assert behavior, and dependencies added without call sites.
- Separate blocking defects from preferences. Label preferences as P3 or omit them.

## Source Links

- Google Engineering Practices, code review: https://google.github.io/eng-practices/review/reviewer/
- Google Engineering Practices, what to look for: https://google.github.io/eng-practices/review/reviewer/looking-for.html
- GitLab code review guidelines: https://docs.gitlab.com/development/code_review/
- CodeRabbit code review overview: https://docs.coderabbit.ai/guides/code-review-overview/
- SWE-PRBench: https://arxiv.org/abs/2603.26130
- CodexKit skills docs, project-scope note: https://codexkit.pages.dev/docs/skills
