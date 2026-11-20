# PTY WebSocket protocol (v1)

1. Client: `POST /v1/pty/tickets` `{workspaceId}` with session cookie, which returns `{ticket, expiresAt}`. The ticket is single-use, has a TTL of 30 s or less, and is bound to (user, workspace).
2. Client: open `wss://<api>/v1/pty?ticket=<ticket>`. The server validates the ticket, consumes it, checks the `terminal:connect` permission and workspace ownership, and attaches to the guest-agent PTY over vsock.
3. Frames are JSON text:

| Direction | Frame |
|---|---|
| C→S | `{"type":"input","data":"<utf-8>"}` |
| C→S | `{"type":"resize","cols":N,"rows":N}` |
| C→S | `{"type":"ping"}` |
| S→C | `{"type":"output","data":"<utf-8>"}` |
| S→C | `{"type":"exit","code":N}` |
| S→C | `{"type":"error","message":"…"}` |
| S→C | `{"type":"pong"}` |

Server limits: input frame ≤ 64 KiB, output coalesced to ~16 ms batches, and the connection is closed after `idleTimeout`. Open and close are written to the audit log.
