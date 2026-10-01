# Markbook preview adds 1000 to its configured port

- **Symptom:** `markbook preview --port 8000` listened on 9000 while port 8000 refused connections.
- **Cause:** In Markbook 0.6, the CLI maps `--port` to `config.dev.port`, and core preview binds `dev.port + 1000`.
- **Fix:** Pass `--port 7000` in `docs:preview` to serve the built site on 8000; verify the bound URL.
- **Prevention:** After changing Markbook or preview options, test the actual listener instead of trusting the `--port` help text.
- **Discovered:** 2026-10-01 during production-domain prompt verification.
