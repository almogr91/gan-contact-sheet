# דף קשר לגן — Kindergarten Contact Sheet

Self-service web app for building a printable A4 contact sheet for a
kindergarten class:

1. **Admin (teacher)** creates a group and gets a shareable form link.
2. **Parents** open the link and submit: child first + last name, photo,
   address, parent 1 name + phone, and optional parent 2 name + phone.
3. **Admin** reviews the submissions and generates a single-page A4 contact
   sheet (print / Save-as-PDF from the browser print dialog).

## Demo status — read this first

This is a **client-side demo build**. There is no backend yet:

- Submissions are stored in `localStorage` of the browser that fills them in,
  so the parent form link works **only on the same browser/device** in this
  version.
- Photos are downscaled in-browser and never leave the device.
- No analytics, no tracking; the only external call is the Heebo font CDN.
- All bundled example content is **synthetic placeholder data** (initial
  avatars, fictional names) — no real children's data.

## Architecture — ready for AWS persistence

The app is structured so the AWS backend plugs in without touching the views:

```
UI (landing / admin / parent form / A4 sheet)
        │
   Store adapter  ← single interface: createGroup, getGroup,
        │           listSubmissions, addSubmission, deleteSubmission
        │
  LocalStore (demo, localStorage)   →   AwsStore (planned)
```

Planned production path once the AWS account is connected:

- **AWS Amplify Hosting** — hosts this static app from the repo, with
  built-in password/access gating for privacy.
- **API Gateway + Lambda + DynamoDB** — groups and submissions tables
  (`groupId` partition key). The parent form writes a submission; the admin
  dashboard reads them.
- **S3** — parent-uploaded photos, private bucket, presigned upload URLs.
- **Auth** — admin signs in (Cognito); parent links carry an unguessable
  group token. Minors' data stays private end-to-end, and nothing is public
  by default.

## Files

- `index.html` — landing, admin dashboard, parent form, A4 sheet markup
- `styles.css` — responsive RTL styling + A4 print stylesheet (`@page A4`)
- `app.js` — hash router, Store adapter, views, print orchestration
- `README.md` — this file

## Run

Static site: open `index.html` or serve the folder with any static host.
Deployed with GitHub Pages (public demo, synthetic data only).
