# AI usage

OpenAI Codex drafted the .NET and React foundation, Docker configuration, and documentation. The initial verification plan expected Docker to be present. A command availability check showed that this environment lacks both Docker and the .NET SDK. Live stack verification therefore remains pending; README.md includes reproducible checks for the target machine.

Codex implemented milestone 2 SQL, the background service, and database checks. During review, the worker design was refined to lock the parent class before updating applications, matching the lock order used by reservations and confirmations.

Codex implemented the eight endpoint handlers, HTTP error mapping and contract checks. The release was prepared against the v0.2.0 baseline. The available runtime lacks Docker and the .NET SDK, so the HTTP tests require execution on the target machine.
