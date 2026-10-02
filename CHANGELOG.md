# Changelog

## 0.1.0

First release, covering the Mista API v3 as documented at https://docs.mista.io:

- SMS: `sms.send`
- Campaigns: `campaigns.bulk`, `campaigns.sendToGroups`, `campaigns.get`
- Logs: `logs.list` (filters + auto-pagination), `logs.get`
- Account: `account.balance`, `account.me`
- Contact groups and contacts: list, create, get, update, delete
- Verify: `verify.start`, `verify.check`, `verify.get`
- Voice: `voice.accessToken`, `voice.numbers`, `voice.calls.list`, `voice.calls.get`
- Typed errors, automatic retries for rate limits, request timeouts
