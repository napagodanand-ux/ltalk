# Code Signing (Windows)

LTalk builds for Windows with [`electron-builder`](https://www.electron.build/).
Signed binaries are strongly recommended for distribution: without a signature,
Windows SmartScreen will warn users during install.

Signing is **wired but optional**. The CI workflow (`build.yml`) reads two
repository secrets and passes them to `electron-builder`, which signs
automatically (SHA-256 + a trusted timestamp). If the secrets are absent, the
build still succeeds — it is simply left unsigned. **No secrets are committed
to the repository.**

## 1. Obtain a code-signing certificate

Use a certificate issued by a public CA (e.g. DigiCert, Sectigo) for
**Authenticode / Windows code signing**. For a budget-friendly, cloud-based
option, [Azure Trusted Signing](https://learn.microsoft.com/azure/trusted-signing/)
integrates well with CI (see notes below).

Export the certificate as a **PFX** (`*.pfx`) file.

## 2. Add the repository secrets

In the repo: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret            | Value                                                          |
| ----------------- | ------------------------------------------------------------- |
| `CSC_LINK`        | Base64 of your `cert.pfx` (or a URL pointing to it)           |
| `CSC_KEY_PASSWORD`| The password for the certificate                              |

To produce the Base64 value locally:

```bash
# Linux / macOS
base64 -w0 cert.pfx > cert.txt
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx")) | Out-File -NoNewline cert.txt
```

Paste the contents of `cert.txt` into the `CSC_LINK` secret.

## 3. Build & publish

Push a new version tag (this triggers the Release workflow, which signs
automatically):

```bash
npm run release:patch   # 1.0.0 -> 1.0.1
```

The published `LTalk-Setup-*.exe` will then carry a valid Authenticode
signature.

## Notes

- **Linux** artifacts (`AppImage`, `deb`) are **not** Authenticode-signed; this
  is standard and not required.
- **macOS** is not currently a build target; add it (and an Apple Developer
  signature / notarization step) if you later ship for macOS.
- **Azure Trusted Signing**: instead of `CSC_LINK`/`CSC_KEY_PASSWORD`, point
  `electron-builder` at your Azure signing identity (typically via the
  `azureSignOptions` configuration). The principle is the same — keep the
  credentials in repository secrets, never in the source tree.

---

# امضای کد (ویندوز)

ساخت ویندوز با استفاده از `electron-builder` انجام می‌شود. امضای دیجیتال برای
توزیع توصیه می‌شود؛ در غیر این صورت SmartScreen هشدار خواهد داد.

امضا **راه‌اندازی شده اما اختیاری** است. Workflow (فایل `build.yml`) دو مخفی
مخزن را می‌خواند و به `electron-builder` می‌دهد که امضا را به‌طور خودکار انجام
می‌دهد (SHA-256 به همراه Timestamp). در صورت نبود این مقادیر، ساخت بدون امضا
انجام می‌شود. **هیچ مخفی‌ای در مخزن کامیت نمی‌شود.**

گام‌ها: دریافت گواهی Authenticode، تبدیل به Base64 و افزودن `CSC_LINK` و
`CSC_KEY_PASSWORD` به عنوان مخفی مخزن، سپس اجرای `npm run release:patch`.
قطعات لینوکس (AppImage/deb) نیازی به امضای Authenticode ندارند.
