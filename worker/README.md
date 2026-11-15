# TradeHax worker

Always-on process for inferred option flow. It is not deployed from this checkout.

- Heroku: `worker/` is the app root. `Procfile` starts Node 22. Set `ALLOWED_ORIGIN=https://darkmodder33.github.io`.
- Azure: the same start command on a B1s Linux app, with the same setting.

`GET /v1/health` is the only route in the skeleton. Live routes arrive with the flow poller. No vendor keys are read by the static site.
