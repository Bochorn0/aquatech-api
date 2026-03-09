# Domain redirect to Azure (domain in Squarespace)

Point **www.lcc.com.mx** (and API) to the new Azure application. The domain **lcc.com.mx** is managed in **Squarespace**.

## Current vs new

| | Current | Azure (new) |
|---|---------|-------------|
| **Domain DNS** | Squarespace | Keep domain in Squarespace; only change DNS records to point to Azure |
| **API** | (previous host) | App Service: `lccapp-aefcbwh0ecd7b8cz.canadacentral-01.azurewebsites.net` |
| **Frontend** | (previous host) | Static Web App: **https://proud-ocean-0563e8f0f.4.azurestaticapps.net/** |

---

## Option A – Custom domain on Azure (recommended)

Keep using **www.lcc.com.mx**; only change DNS in Squarespace so it points to Azure.

### 1. Add custom domain in Azure

**API (App Service)**  
- Azure Portal → your App Service (**lccapp**) → **Custom domains**.  
- Add: `api.lcc.com.mx` (or `www.lcc.com.mx` if the API is the only thing on that host).  
- Note the **CNAME target** Azure shows (e.g. `lccapp-aefcbwh0ecd7b8cz.canadacentral-01.azurewebsites.net`).  
- If you use **www** for the frontend only, use a separate host for API, e.g. `api.lcc.com.mx` → App Service.

**Frontend (Static Web App)**  
- Azure Portal → your Static Web App → **Custom domains**.  
- Add: `www.lcc.com.mx`.  
- CNAME target: **`proud-ocean-0563e8f0f.4.azurestaticapps.net`** (or the value Azure shows in Custom domains).

### 2. Change DNS in Squarespace

In **Squarespace**:

1. Go to **Settings** → **Domains** → **lcc.com.mx** (or your connected domain).
2. Click **DNS Settings** (or **Manage DNS** / **Advanced Settings** depending on your plan).
3. Add or edit records as below. If Squarespace currently has **www** or **api** pointing elsewhere (e.g. Squarespace site or another host), remove or replace those records.

| Type | Host / Name | Value (target) |
|------|-------------|----------------|
| **CNAME** | **www** | `proud-ocean-0563e8f0f.4.azurestaticapps.net` |
| **CNAME** | **api** | `lccapp-aefcbwh0ecd7b8cz.canadacentral-01.azurewebsites.net` |

**Squarespace notes:**  
- “Host” might be “www” or “www.lcc.com.mx” depending on the UI; use what Squarespace asks for (often subdomain only).  
- If you don’t have **Advanced** or **DNS** settings, the domain may be “fully managed” by Squarespace; then use **Settings → Domains → Connect external host** or contact support to add CNAMEs for **www** and **api**.  
- **Apex (naked domain)** `lcc.com.mx`: Squarespace often wants to keep apex on their servers. You can leave it pointing to Squarespace and only change **www** and **api**, or add a redirect in Squarespace from `lcc.com.mx` → `www.lcc.com.mx`.

If you use **www** for both frontend and API (same origin), point **www** to the App Service CNAME target and configure Azure to serve both; then you only need one CNAME for **www**.

### 3. Frontend build when using custom domain

If the app is reached at **https://www.lcc.com.mx** and the API at **https://api.lcc.com.mx**:

- Set at build time (e.g. in Azure Static Web App config or GitHub Actions):
  - `REACT_APP_API_BASE_URL=https://api.lcc.com.mx/api/v1.0`
  - `REACT_APP_API_BASE_URL_V2=https://api.lcc.com.mx/api/v2.0`
- If API and frontend share **www.lcc.com.mx** (e.g. `/` = front, `/api` = API), use:
  - `REACT_APP_API_BASE_URL=https://www.lcc.com.mx/api/v1.0`
  - `REACT_APP_API_BASE_URL_V2=https://www.lcc.com.mx/api/v2.0`

No code change is required if env vars are set as above.

### 4. API (App Service) env

- **FRONTEND_URL** (or **BASE_URL**): set to the final frontend URL so emails/links point to the right place, e.g.  
  `FRONTEND_URL=https://www.lcc.com.mx`

---

## Option B – Redirect in Squarespace to Azure URL

If you prefer the domain to **redirect** to the Azure URLs (browser shows the azurewebsites.net address):

- In **Squarespace**: **Settings** → **Domains** → **Redirects** (or **URL redirects**). Add a redirect from `https://www.lcc.com.mx` to **https://proud-ocean-0563e8f0f.4.azurestaticapps.net/** (frontend) if you use a separate front URL.  
- Squarespace redirects usually apply to the main site; for **api.lcc.com.mx** you’d point it via DNS (CNAME) to the Azure App Service instead of a redirect.  
- After redirect, the frontend build must use the Azure API URL (already set in the GitHub workflow for the Static Web App build).

---

## Checklist

- [ ] Add custom domain(s) in Azure (App Service + Static Web App if used).  
- [ ] In **Squarespace** DNS: add CNAME for **www** (→ Static Web App) and **api** (→ App Service).  
- [ ] Set **REACT_APP_API_BASE_URL** / **REACT_APP_API_BASE_URL_V2** for the build to match your API host (e.g. `https://api.lcc.com.mx/api/v1.0` or Azure URL).  
- [ ] Set **FRONTEND_URL** (and **BASE_URL** if used) in App Service to the final frontend URL (e.g. `https://www.lcc.com.mx`).  
- [ ] (Optional) Use Squarespace redirects if you want www.lcc.com.mx to redirect to the Azure hostname instead of custom domain.
