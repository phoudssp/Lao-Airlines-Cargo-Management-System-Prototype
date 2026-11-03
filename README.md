# Lao Airlines Air Cargo Management System: prototype

A clickable prototype by Loopware for Lao Airlines' Cargo Department. It runs entirely in the browser. All data is synthetic, and changes stay in the viewer's browser until they choose "Reset demonstration data".

## Run locally

```bash
npm install
npm run dev
```

## Host on GitHub Pages

1. Create a GitHub repository and push the contents of this `prototype` folder to its `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Each push to `main` then builds and publishes the site through `.github/workflows/deploy.yml`. The address appears on the Pages settings screen.

## Rebuild the PDF walkthrough

```bash
npm run build
node scripts/make-pdf.mjs
```

The PDF is written to `../ຕົ້ນແບບລະບົບ - Lao Airlines Cargo.pdf`. It uses the Chrome installed on the computer.
