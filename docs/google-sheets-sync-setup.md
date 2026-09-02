# Google Sheets operations sync

The operations sheet is:

- Spreadsheet ID: `1MDNnsv9akz2y9ADL0Dmi285hjjlG5mv9HSzqP3O8sHQ`
- Sheet tab: `سجل العمليات`
- Expected columns: 20

The runtime needs two Vercel environment variables:

- `OPS_SHEETS_WEBHOOK_URL` — deployed Google Apps Script Web App URL
- `OPS_SHEETS_WEBHOOK_TOKEN` — shared secret that must also be stored in Apps Script Script Properties as `OPS_SYNC_TOKEN`

Use `docs/google-sheets-webhook.gs` as the Apps Script code. Deploy it as a Web App with execute-as owner and access set so the production server can POST to it.

The application stores every lounge entry in the database first. Google Sheets is a secondary accounting mirror. Failed or pending rows are retained in the database and can be retried from the owner/manager sync panel.
