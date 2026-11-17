# 11 — Deployment and Operations

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 11
- **Status:** Authoritative Deployment & Operations Runbook
- **Version:** 5.0.0 (Canonical Four-Table Architecture)
- **Last Verified Date:** 2026-11-17
- **Audience:** DevOps, site reliability engineers, AI coding agents

---

## 2. Infrastructure Topology

```text
┌─────────────────────────────────┐
│     User Browser (Admin)        │
└───────────────┬─────────────────┘
                │
                ├─────────────────────────────────────────┐
                ▼ HTTPS GET (Static Assets)               ▼ HTTPS POST (API Calls)
┌─────────────────────────────────┐       ┌──────────────────────────────────────────┐
│      Vercel Hosting (SPA)       │       │    Google Apps Script Web App Endpoint   │
│  - React 18 / Vite static build │       │  - Execute as: Owner                     │
│  - vercel.json SPA rewrites     │       │  - Who has access: Anyone                │
│  - Security HTTP headers        │       │  - HMAC-SHA256 Session Verification      │
└─────────────────────────────────┘       └───────────────────┬──────────────────────┘
                                                              │ Apps Script Services
                                                              ▼
                                          ┌──────────────────────────────────────────┐
                                          │     Canonical Google Spreadsheet         │
                                          │  - ID: 1cVQknq_Ix-T6igp7c-DwwuY...       │
                                          │  - Strictly 4 physical canonical tables  │
                                          └──────────────────────────────────────────┘
```

---

## 3. Frontend Build & Vercel Deployment

### 3.1 Build Output
- Build command: `npm run build` (`tsc && vite build`).
- Output directory: `dist/`.
- Target environment: Modern evergreen browsers (ES2022).

### 3.2 SPA Routing Configuration (`vercel.json`)
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### 3.3 Frontend Environment Variables
Configure in Vercel project settings or `.env.local`:
```bash
# Production Apps Script Web App exec URL
VITE_APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbx4d_VG4CsZIEAomX_OjNMuej06ktTYmKLME5ennLsI7mx3Fn5b-YBu9CRqe7NwrUVH3w/exec"

# Application Title in Header
VITE_APP_TITLE="Student Management Dashboard"

# Local testing flag (leave unset or false in production)
VITE_USE_MOCK_DATA="false"
```

---

## 4. Google Apps Script Backend Deployment

### 4.1 Clasp Configuration (`.clasp.json`)
```json
{
  "scriptId": "1CC_ZjGrLBD8BnrAm6CP9oDUJmUPqFy4MCc-MkBiBvCNkMA616uF_pCPL",
  "rootDir": "02-backend/apps-script"
}
```

### 4.2 Web App Execution Settings
In the Google Apps Script project settings:
- **Execute as:** Must be **`Me (the spreadsheet owner)`**.
  *(Allows the Web App to read and write the private spreadsheet using the owner's Google permissions without prompting the user for Google OAuth consent.)*
- **Who has access:** **`Anyone`**.
  *(Required so cross-origin POST requests from Vercel can reach the script. Security and authorization are handled inside `IdentityVerifier.gs` via HMAC-SHA256 session tokens and the admin allowlist).*

### 4.3 Script Properties Configuration
Configure in Apps Script Project Settings $\rightarrow$ Script Properties:
| Property | Value Description |
|---|---|
| `ADMIN_AUTH_KEY` | Cryptographic secret key used to sign and verify HMAC-SHA256 session tokens |
| `ADMIN_EMAILS` | Comma-separated admin allowlist (`ashreya0502@gmail.com`) |
| `DEFAULT_TIMEZONE` | `Asia/Kolkata` |
| `DEFAULT_CURRENCY` | `INR` |
| `SCHEMA_VERSION` | `2.0.0` |

### 4.4 Deployment Version Distinction & Frozen State
The documentation strictly distinguishes five layers of project state:
1. **GitHub Source Code:** Merged into `main` at commit `620aaf7`. Authoritative source of truth for all implementations and tests.
2. **Apps Script Project Files:** Code uploaded via clasp. Changes merged into `main` are not pushed to Apps Script until authorized.
3. **Active Production Deployment Version:** The active production deployment ID `AKfycbx4d_VG4CsZIEAomX_OjNMuej06ktTYmKLME5ennLsI7mx3Fn5b-YBu9CRqe7NwrUVH3w` is **STRICTLY FROZEN** at version **`@52`**.
4. **Frontend Production Deployment:** Vercel SPA build serving client assets.
5. **Local Verification:** Verified locally with 651 passing tests across 75 test files, 0 type errors, clean build, and clean line limits.

> [!WARNING]
> **PRODUCTION DEPLOYMENT FREEZE:**
> Production deployment `@52` is frozen. No developer or AI agent is authorized to execute `clasp push`, `clasp deploy`, or edit live Google Sheets without explicit owner authorization. Merged code in `main` must not be described as live in production until deployed and verified.

---

## 5. Backup, Recovery & Rollback Runbook

### 5.1 Spreadsheet Backup Procedure
1. Create a point-in-time copy of the master Google Spreadsheet (`File -> Make a copy`).
2. Label with ISO timestamp (e.g. `Master Backup (Pre-Launch 2026-10-21T12-13-40-537Z)`).
3. The system retains historical migration backups inside the spreadsheet (e.g. `StudentId_Migration_Backup`, `_Backup_PreFourTable_*`).

### 5.2 Rollback Procedures
- **Frontend Rollback:** In the Vercel dashboard, promote the previous successful deployment to production with one click.
- **Backend Rollback:** In Apps Script, open **Deploy -> Manage deployments**, edit the active deployment, and revert the version dropdown to the previous stable version number.
- **Data Rollback:** If accidental row mutation occurs, restore the specific table from the point-in-time spreadsheet backup or revision history.
