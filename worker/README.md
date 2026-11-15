# TradeHax worker

Always-on process for inferred option flow. It is not deployed from this checkout.

- Heroku: `worker/` is the app root. `Procfile` starts Node 22. Set `ALLOWED_ORIGIN=https://darkmodder33.github.io`.
- Azure: the same start command on a B1s Linux app, with the same setting.

`GET /v1/health` reports whether `ALPACA_KEY_ID` is set. Flow, tide, alerts, NOPE, and off-exchange routes answer with an empty tape and `live feed not connected` until a poller has diffs or Alpaca keys exist on the server. Do not put those keys in the static site.

Azure App Service uses the same start command as Heroku. Set `ALLOWED_ORIGIN` and, when you have them, `ALPACA_KEY_ID` and `ALPACA_SECRET`. `worker/src/alpaca.ts` only builds request URLs.
