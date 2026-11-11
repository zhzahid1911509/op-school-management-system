# AI Usage

**Tool:** OpenAI ChatGPT / Codex.

**Where I used it:** AI assisted with planning and generated substantial parts of the ASP.NET Core API, PostgreSQL reservation functions, React interface, Docker setup, automated tests and documentation. This is an AI-assisted project; I do not present all generated code as independently handwritten work.

**My contribution:** I supplied the assignment and directed the implementation in stages. I ran local setup commands, reported Git/Docker and acceptance-build problems, and requested corrections. I also specified live birth-registration feedback, the 17-digit counter and short public IDs, and checked requirement coverage for configurable URLs, hold duration and the Bangla-default bilingual interface.

**Mistakes and corrections:**

- The AI initially planned verification as though Docker and the .NET SDK were available in its environment. Tool checks showed they were absent, so live acceptance was explicitly left pending rather than reported as passed.
- AI-assisted review found that a frontend test mock shared mutable objects with the UI, allowing a misleading polling result. Returning independent snapshots corrected the test. Review also found that a temporary database volume could not demonstrate persistence after container removal; the test setup was changed to a named volume.
- My Windows acceptance run stalled while downloading the Python Playwright package. I reported the log; the AI-assisted revision switched to a matching Node Playwright Core driver using the preinstalled browser image.

**Verification boundary:** Frontend tests and the production build passed in the preparation environment. Real PostgreSQL concurrency, backend compilation and the complete Docker acceptance run still need a successful target-machine run; the presence of test code alone is not a passing result.
