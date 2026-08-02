# OGDC Internee Management System

A LAN-hosted web application for registering internees, storing their documents, and
showing management how intake compares across universities, degrees, cities,
departments, and time.

Runs as a single Node process on one machine. Everyone else on the OGDC network opens
it in a browser — nothing to install on their computers.

---

## What it does

- **Internee records** — personal details, contact and emergency contact, education,
  OGDC department and supervisor, internship dates and status, completion certificate
  and supervisor evaluation.
- **Documents** — joining letter, transcript, degree, CNIC, photograph and more, as
  **PDF, Word (.doc / .docx) or image**. Attach them **directly on the Add Internee
  form** (they upload the moment the record is created) or later from the internee's
  Documents tab. PDFs and pictures preview in the browser; Word files download to open
  in Word. Only signed-in users can open any of them.
- **Dashboard** — totals, this week / month / 3 months / 6 months / year against the
  previous period, joining trend, breakdowns by university, degree, department and
  city, year-on-year comparison, and a cross-tab of any dimension against any other.
- **Reports** — filter, choose columns, export to CSV or print.
- **Import** — bring an existing spreadsheet in, with a full validation preview before
  anything is saved.
- **Administration** — user accounts and roles, the reference lists the dashboard groups
  by, one-click backups, and an activity log of who changed what.

---

## Requirements

- **Node.js 22.5 or newer** (built and tested on Node 25). Nothing else — no database
  server, and no native modules to compile.
- Windows, macOS or Linux. The instructions below are written for Windows.

---

## First-time setup

```bash
npm install
```

Copy `.env.example` to `.env` and set the data folder:

```
PORT=4000
DATA_DIR=C:\OGDC-Internee-Data
```

(On this development machine `.env` already points at `C:\Users\ahtsh\OGDC-Internee-Data`,
which is outside OneDrive. Use whatever path suits the OGDC server — just keep it off any
synced drive.)

> **`DATA_DIR` must not be inside OneDrive, Dropbox or any syncing folder.** Sync
> clients lock files while they upload them; pointed at a live SQLite database (and its
> `-wal` / `-shm` companions) that will corrupt it. The application prints a warning if
> it detects one. The project code can live anywhere; the *data* cannot.

Then build the frontend and start:

```bash
npm run build
npm start
```

On first start the database is created, the reference lists are populated, and an
administrator account is generated. **The password is printed to the console exactly
once:**

```
  ┌──────────────────────────────────────────────────────┐
  │  Administrator account created                       │
  │  username: admin                                     │
  │  password: EXAMPLE-NOT-REAL                          │
  │                                                      │
  │  This is shown once. You must change it at login.    │
  └──────────────────────────────────────────────────────┘
```

Sign in with it; you will be asked to choose your own password before anything else
loads.

---

## Opening it from other computers

When the server starts it prints the addresses to use:

```
  Local        http://localhost:4000
  On this LAN  http://192.168.18.43:4000
  Data folder  C:\OGDC-Internee-Data
```

Everyone else on the OGDC network opens the **On this LAN** address.

If they cannot reach it, Windows Firewall is almost certainly blocking the port. Run
this once, in PowerShell **as Administrator**, on the server machine:

```powershell
New-NetFirewallRule -DisplayName "OGDC Internee System" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Domain,Private
```

Give the server machine a fixed IP (or a DNS name) so the address does not change when
it reboots.

---

## Everyday commands

| Command | What it does |
|---|---|
| `npm start` | Start the application (serves the API and the site on one port) |
| `npm run dev` | Development mode — API on 4000, Vite on 5174 with hot reload |
| `npm run build` | Rebuild the frontend after changing any code |
| `npm run seed:demo` | Fill an **empty** database with ~240 realistic sample internees |
| `npm run reset-password -- <username>` | Reset a password from the server console |

### If someone forgets their password

An administrator can reset it from **Administration → Users**. If the *administrator*
is locked out, there is no email recovery on a private network — reset it from the
server machine:

```bash
npm run reset-password -- admin
```

A new password is printed once, and the user must change it at their next sign-in.

---

## Who can do what

| | Administrator | HR / Data Entry | Viewer |
|---|---|---|---|
| Dashboard, internee list, reports | ✓ | ✓ | ✓ |
| View and download documents | ✓ | ✓ | ✓ |
| Add / edit internees, upload documents | ✓ | ✓ | |
| Import a spreadsheet | ✓ | ✓ | |
| Manage users and reference lists | ✓ | | |
| Backups, restore deleted records | ✓ | | |

Permissions are enforced on the server, not just hidden in the interface.

---

## Keeping the reference lists clean

Universities, degrees, departments, cities and supervisors are **chosen from lists**,
not typed in freely. This is deliberate: it is what makes "internees by university"
mean anything. If the same university could be typed as `UMT`, `U.M.T` and
`University of Management & Technology`, it would appear three times on the dashboard
and every comparison would be wrong.

Administrators manage these lists under **Administration → Lookups**. An entry that is
already used by an internee is **hidden rather than deleted**, so existing records keep
their value.

---

## Backups

**Administration → Backups → Create backup now** produces one zip containing the
database and every uploaded document. The database is copied out using SQLite's online
backup, so it is safe to do while people are using the system.

Download backups and keep a copy somewhere else. A backup that only exists on the
server does not survive the server failing.

### Restoring

1. Stop the application.
2. Unzip the backup.
3. Copy `internees.db` and the `uploads` folder into your `DATA_DIR`, replacing what is
   there.
4. Start the application again.

---

## Security, stated plainly

- Passwords are hashed with scrypt. They are never stored or logged in readable form.
- Documents are served only to signed-in users, through the application — they are not
  in a public folder, so a CNIC scan cannot be fetched by guessing a URL.
- Uploads are limited to PDF, Word (.doc, .docx) and images (JPG, JPEG, PNG, WebP, GIF,
  BMP), capped at 10 MB, and stored under generated filenames. `.heic` (the iPhone
  default) and `.tiff` are refused because browsers cannot display them — the message
  says so and explains how to convert. A file whose browser-reported type is vague
  (Windows often sends `application/octet-stream` for Word files) is accepted only when
  its extension is one of those; a file that positively declares a type we do not
  accept is always refused, whatever it is named.
- Deleting an internee hides the record; an administrator can restore it. Nothing is
  erased silently.
- Every create, edit, delete, upload, login and failed login is written to the activity
  log.
- Repeated failed logins from the same machine are locked out for 10 minutes.

**Known limitation:** traffic between browsers and the server is plain HTTP, so it is
not encrypted on the network. That is normal and acceptable for an internal, private
network. If OGDC IT wants encryption later, it is added by putting a reverse proxy with
an internal certificate in front of the application — no change to the application
itself.

---

## Keeping it running after a reboot

As set up, the application runs in a terminal window and stops when that window is
closed. To make it start automatically and survive reboots, install it as a Windows
service with [NSSM](https://nssm.cc/):

```powershell
nssm install "OGDC Internee System" "C:\Program Files\nodejs\node.exe" "C:\path\to\ogdc-internee-system\server\src\index.js"
nssm set "OGDC Internee System" AppDirectory "C:\path\to\ogdc-internee-system"
nssm start "OGDC Internee System"
```

---

## How it is built

```
server/            Express API + SQLite
  src/db/          schema, migrations, seeds  (node:sqlite — no native modules)
  src/routes/      auth, interns, documents, analytics, lookups, users, reports, backups
  src/services/    intern queries, analytics SQL, CSV import
client/            React + Vite
  src/styles/      tokens.css — the single source of colour, type and spacing
  src/charts/      Recharts, themed from those tokens
  src/pages/       one file per screen
```

The frontend is built into `client/dist`, which the server serves itself — that is why
there is only one port to remember.

**A note on colour:** the chart palette is not decorative. Its eight hues and, more
importantly, their *order* were checked for colourblind separation, contrast against
both the light and dark backgrounds, and lightness consistency. Reshuffling them would
quietly break that. Charts also carry direct value labels and a table view so no
figure is ever conveyed by colour alone.
