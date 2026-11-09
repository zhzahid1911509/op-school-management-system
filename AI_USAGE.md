# AI usage

OpenAI Codex drafted the .NET and React foundation, Docker configuration, and documentation. The initial verification plan expected Docker to be present. A command availability check showed that this environment lacks both Docker and the .NET SDK. Live stack verification therefore remains pending; README.md includes reproducible checks for the target machine.

Codex implemented milestone 2 SQL, the background service, and database checks. During review, the worker design was refined to lock the parent class before updating applications, matching the lock order used by reservations and confirmations.

Codex implemented the eight endpoint handlers, HTTP error mapping and contract checks. The release was prepared against the v0.2.0 baseline. The available runtime lacks Docker and the .NET SDK, so the HTTP tests require execution on the target machine.

Codex implemented milestone 4 React screens and component tests. Review found a test mock shared mutable class objects with the UI, which could let the availability test pass without a network refresh. Returning snapshots fixed the test and made it exercise periodic polling.

Codex added milestone 5 acceptance tests and reviewed their isolation. The earlier test database used tmpfs, which discarded data when the container was removed. A named volume now enables a real down/up persistence check. Docker and .NET were unavailable in the preparation environment, so the final live acceptance result must be recorded on a Docker host.

For v0.5.1, Codex replaced the Python browser driver with the matching Node Playwright Core package after a Windows build paused downloading the Python wheel. The browser test still exercises the same admission flow.
