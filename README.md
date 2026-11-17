# ZeroForex INR Card Converter

A static, installable PWA for estimating INR charges on zero-forex cards. It uses live exchange rates when online and saved rates offline.

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. Open the repository’s **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder, then save.
5. Wait for the Pages deployment to finish. GitHub will show the site URL in the Pages settings.

The root `index.html` redirects visitors to `converter.html`, so both the repository Pages URL and its `/repository-name/` path work. The PWA uses relative paths for its manifest, service worker, and icons, so it does not need a custom base-path setting.

## Install on a phone

- **iPhone/iPad:** open the HTTPS Pages URL in Safari, tap **Share → Add to Home Screen**.
- **Android:** open the HTTPS Pages URL in Chrome and choose **Install app** or **Add to Home screen**.

Open the app online once before relying on offline mode. The service worker caches the app shell and remote styling assets on first visit; exchange rates are saved locally when they load successfully.

## Updating the offline app shell

When changing the precached files in `sw.js`, increment `CACHE_VERSION` near the top of that file, then push the change. This causes browsers to install a fresh cache on the next visit.
