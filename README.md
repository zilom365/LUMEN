# Lumen Memorials

A browser-based Memorial Platform developed as an academic capstone project. It provides administrator, family-member, and guest experiences for managing and exploring digital memorials.

## Features
- Administrator and family-member dashboards.
- Guest access to public memorials.
- Memorial creation and management.
- Photo and video management.
- Cemetery locations and Google Maps directions.
- QR code generation for memorial pages.
- Memorial-specific Memory Companion.
- JSON data backup and restore.

## Technologies
- HTML, CSS, JavaScript
- Python (Standard Library)
- Docker
- Vercel (Deployment)

## Run Locally

1. Install Python 3.
2. Extract the project ZIP.
3. Run `run-windows.bat` on Windows.
4. Open `http://localhost:5500`.

Alternatively, run:

```bash
py serve.py
```

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@lumen.demo | admin123 |
| Family | member@lumen.demo | lumen123 |

Guests can select **Continue as Guest**.

## Project Structure

- `index.html` – Main webpage
- `app.js` – Application functionality
- `styles.css` – Website styling
- `store.js` – Data management
- `assets/` – Images and resources
- `docs/` – SRS and system diagrams
- `serve.py` – Python server
- `Dockerfile` – Container configuration

## Deployment

The project includes a Dockerfile for container-based deployment. The GitHub repository can be connected to Vercel for hosting.

## Team Contributions

**Teammate 1:**
- Application development
- SRS and system design
- Frontend implementation

**Teammate 2:**
- Project journal
- README and Notion updates
- Deployment verification

## Project Links

- **GitHub:** https://github.com/zilom365/LUMEN.git
- **Live Website:** https://lumen-sepia-psi.vercel.app/

## Note

This is an academic demonstration project. Authentication and data storage are browser-based and are not suitable for production use. Do not enter real passwords or sensitive personal information.

**Lumen Memorials – Keeping Memories Alive.**