# Lumen SAR Memorials

A portable, browser-based SAR capstone project with administrator, family-member, and guest experiences. It uses Python’s standard library; no package installation is needed.

## Run on a Windows laptop

1. Extract `Lumen-SAR-Memorials-Laptop.zip` to a folder.
2. Install Python 3 if needed.
3. Double-click `run-windows.bat`.
4. Open `http://localhost:5500` if it does not open automatically. Keep the server window open; press **Ctrl+C** to stop.

If the batch file cannot find Python, run `py serve.py` in the extracted folder. On macOS/Linux, run `python3 serve.py`. Do not open `index.html` as a `file://` page; JavaScript modules require HTTP.

## Sign-in

- Administrator: `admin@lumen.demo` / `admin123` — this exact pair opens the administrator workspace.
- Family member: `member@lumen.demo` / `lumen123`.
- Guest: choose **Continue as guest** to view public memorials.

The sign-in screen includes quick workspace shortcuts for a class demonstration. **Open administrator panel** skips credential entry and is not secure authentication; to demonstrate the credential route, enter the administrator email and password shown above.

Other family accounts must first be registered. Administrator tools can add, edit, delete, publish/private, and manage photos/videos for memorials. Photos on public memorials are free to view. Videos are limited to 60 seconds; uploaded clips are capped at 100 MB, subject to browser storage availability. The **Unlock video access** button changes only a browser-local demo flag. It is not a real subscription, payment, or recurring charge. Administrators can preview clips. Public direct video URLs must be directly reachable by the browser.

## Cemetery locations and directions

The map view gives a cemetery-level destination, an embedded OpenStreetMap view, and a Google Maps directions link. It does not locate the named person's individual grave. Known destinations are:

| Cemetery | Public address/area | Cemetery map coordinate |
| --- | --- | --- |
| Azimpur Graveyard | 154 New Polton Lane, Dhaka 1205 | 23.729521, 90.382014 |
| Jurain Graveyard | Jurain Kobor Stan Road, Ward 83, Dhaka | 23.697264, 90.429209 |
| Banani Graveyard | Banani, Dhaka 1213 | 23.79957, 90.40397 |

Addresses and map references are recorded in [cemetery-sources.md](cemetery-sources.md). These are cemetery locations, not verified grave plots. No section, plot number, internal walkway, or individual grave coordinates are invented. An administrator may enter a verified section/plot reference; the app still routes only to the cemetery until an official internal map/plot coordinate is supplied.

## Memory Companion

Each public memorial has its own **Talk to them** conversation. Opening it shows a consent checkbox; the message box stays disabled until it is checked. The companion is AI, not the deceased, cannot contact them, and does not know what they would have said. Visitor messages appear on the right and companion replies on the left. Chat history stays in that memorial’s open page session and is not written to local storage.

The laptop ZIP does not contain AI credentials, so its **guided scripted demo** replies to the visitor and follows the recent exchange, but it is not live AI and does not make up personal facts. In managed Preview, live replies work only when the server confirms that an AI model is available; those requests use project credits and require consent. If the local chat endpoint cannot be reached, the visitor’s message remains visible and a connection notice tells the presenter to check that the server is running. Do not enter sensitive information.

## Bangladesh memorial records

The initial archive includes Jannatul Ferdos Achol, Mashrafi Rahman Efti, and Rahatul Ashekin Zidan at Azimpur; A.S.M. Abdul Muqtadir and Kanij Fatema Mukti at Jurain; one clearly labelled fictional sample for Jurain; and three clearly labelled fictional samples for Banani. No dates, biographies, section numbers, or plot numbers are invented. Add verified details only when a family provides them. Browser-schema migration replaces old built-in samples while retaining user-created records where possible. **Administrator → Settings → Restore initial records** replaces local changes with the supplied starting archive.

## QR links, backups, and operating limits

QR codes link directly to a memorial and can be copied or downloaded as SVG/PNG. A phone using mobile data cannot reach a laptop address on university Wi-Fi. `localhost` only works on the laptop, and a private Wi-Fi IP only works for devices on that same reachable network. To scan across networks, the app must be hosted at a public HTTPS address; set that address under **Administrator → Settings** and create a fresh QR. Until public hosting is set up, show the QR as a local-demo example and explain that cross-network scanning is not enabled. For same-Wi-Fi testing, use the laptop IP and port 5500, leave the server running, and permit Python through the laptop firewall.

Administrator settings also support JSON export/import for moving the app between browsers/laptops. Uploaded video blobs live in that browser’s IndexedDB and are **not embedded in JSON backups**; upload them again on the destination laptop. Photos and memorial records remain browser-local.

This is demonstration software, not production SAR software. Demo passwords and role checks are in browser code; records are not protected by production authentication and do not synchronize between devices. The video-access action is not billing or a secure entitlement. Do not use real passwords or sensitive/private family information until secure authentication, server-side authorization, durable storage, privacy controls, and payment infrastructure are implemented.

## Web deployment contract

The root `Dockerfile` packages the Python standard-library server and only the browser files/assets it needs. It runs as a non-root user, honors the platform-provided `PORT` (default 3000), and serves `/_app/health` as an unauthenticated readiness check. The container build does not copy `.env` files or inject Preview/development credentials. The app remains a public capstone demo: it has browser-local demo accounts and data, not production authentication, shared storage, or a secure administrator role. Do not add real memorial data or production credentials to this demo deployment.
