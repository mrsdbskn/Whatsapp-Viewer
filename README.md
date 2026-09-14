# WhatsApp Crypt15 Backup Viewer & AI Texting Assistant

A modern, client-side, single-page Vue 3 web application to decrypt, view, and analyze WhatsApp Android backups (`msgstore.db.crypt15`) with an authentic AI texting assistant powered by Google Gemini 3.8 Flash.

## ✨ Features

- **100% Client-Side Decryption**: Decrypts `msgstore.db.crypt15` files directly in your browser using the Web Crypto API (`HMAC-SHA256` key derivation, `AES-GCM` decryption) and `pako` zlib inflation. Zero file or key data ever leaves your device.
- **Modern OLED Dark Theme**: Designed with deep OLED slate (`#0B141A`), elevated panels (`#182229`), authentic WhatsApp emerald sent bubbles (`#005C4B`), and dark charcoal received bubbles (`#202C33`).
- **sql.js Database Engine**: Queries chat threads, message counts, and timestamps in memory using SQLite WASM.
- **In-Chat Search & Date Filtering**: Filter conversations by date range, sender (sent/received), or full-text search with keyword highlighting.
- **Authentic Texting AI (Gemini 3.8 Flash)**: Analyzes your sent texting history to extract your authentic style fingerprint (casing habits, message brevity, emoji frequency, period omission) and generates 3 natural response options (*Quick & Casual*, *Thoughtful & Detailed*, *Witty & Lighthearted*).
- **Export to WhatsApp TXT**: Export filtered chats to standard WhatsApp `.txt` format (`[DD/MM/YYYY, HH:MM:SS] Sender: Message`) or structured JSON.
- **Automated GitHub Pages Deployment**: Fully configured with GitHub Actions to build and deploy automatically on push to `main`.

---

## 🚀 Quick Start Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```

---

## 🌐 Deploying to GitHub Pages

1. Push this repository to GitHub (to your `main` branch).
2. Go to your repository **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish your site!
