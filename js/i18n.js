/* ============================================================================
   i18n.js — tiny two-language engine (English + Indonesian), no dependencies
   beyond ND.util. Static text is translated by tagging elements:
     data-i18n="key"          -> sets textContent
     data-i18n-html="key"     -> sets innerHTML (values may contain <code>/<a>/<b>)
     data-i18n-attr="attr:key, attr2:key2" -> sets attributes (placeholder, title…)
   Dynamic strings from the other scripts call ND.t("key", { vars }).
   Values may embed {name} placeholders, filled from the vars object.
   ==========================================================================*/
(function (ND) {
  "use strict";
  const STORE_KEY = "nd.lang";

  const dict = {
    en: {
      /* meta */
      "meta.title": "Noisy Deploy: ship any site to GitHub Pages from your browser",

      /* nav */
      "nav.how": "How it works",
      "nav.guide": "Token guide",
      "nav.faq": "FAQ",
      "nav.team": "Team",
      "nav.lang": "Language",
      "nav.menu": "Menu",

      /* hero */
      "hero.sub": "Drop your files, paste a token, get a live link. Your site goes straight to GitHub Pages from the browser.",
      "hero.cta.start": "Start deploying",
      "hero.cta.token": "How to get a token",
      "hero.fact1": "<b>No terminal.</b> No git commands.",
      "hero.fact2": "<b>No server.</b> Your token never leaves your browser.",
      "hero.fact3": "<b>No build step.</b> Static files go live as-is.",

      /* console */
      "console.h": "Deploy console",
      "console.sub": "Four steps. The last one is watching it go live.",
      "stepper.aria": "Deployment progress",
      "step.connect": "Connect",
      "step.files": "Files",
      "step.config": "Configure",
      "step.deploy": "Deploy",

      /* connect panel */
      "connect.h": "Connect your GitHub",
      "connect.p": "Paste a personal access token with the <code>repo</code> scope. It is stored only in this browser and sent only to GitHub.",
      "connect.label": "GitHub token",
      "connect.placeholder": "ghp_… or github_pat_…",
      "connect.hint": 'Need one? <a href="https://github.com/settings/tokens/new?description=Noisy%20Deploy&scopes=repo" target="_blank" rel="noopener noreferrer">Create a token with the right scope</a>, or read the <a href="#guide">step-by-step</a>.',
      "connect.btn": "Connect",
      "connect.continue": "Continue",
      "connect.forgetToken": "Forget token",
      "connect.privacy": "Your token lives in <code>localStorage</code> on this device only. Use <b>Forget</b> to wipe it.",

      /* files panel */
      "files.h": "Add your files",
      "files.p": "Drop a folder or pick files. HTML, CSS, JS, images, fonts. All of it.",
      "files.dzAria": "Drop files here, or press Enter to choose files",
      "files.dzTitle": "Drag & drop your site here",
      "files.or": "or",
      "files.chooseFiles": "Choose files",
      "files.chooseFolder": "Choose folder",
      "files.clearAll": "Clear all",
      "files.preview": "Preview <code>index.html</code>",
      "files.back": "Back",
      "files.continue": "Continue",

      /* config panel */
      "config.h": "Name your project",
      "config.p": "This becomes the repository name and the last part of your URL.",
      "config.label.name": "Project name",
      "config.namePlaceholder": "my-cool-site",
      "config.urlPrefix": "Your site will live at",
      "config.label.desc": "Description <span class=\"opt\">(optional)</span>",
      "config.descPlaceholder": "A little site I made",
      "config.note": "Repositories are created <b>public</b> so GitHub Pages works on the free plan. Re-using a name updates that same project.",
      "config.back": "Back",
      "config.deploy": "Deploy it",

      /* success panel */
      "success.h": "It is live",
      "success.open": "Open site",
      "success.copy": "Copy link",
      "success.repo": "View repo",
      "success.another": "Deploy another",

      /* log */
      "log.title": "deploy log",

      /* how it works */
      "how.h": "Three moves to live",
      "how.sub": "It reads like a chat command and runs like a pipeline.",
      "how.s1.h": "Connect",
      "how.s1.p": "Paste a GitHub token once. It stays on your device and talks only to GitHub.",
      "how.s2.h": "Drop files",
      "how.s2.p": "Add a single page or a whole folder. Images and fonts come along for the ride.",
      "how.s3.h": "Deploy",
      "how.s3.p": "A repo is created, your files are committed, and Pages is switched on. You get a link.",

      /* guide (token tutorial) */
      "guide.h": "Connect to GitHub in four steps",
      "guide.sub": "A token is like a temporary key that lets Noisy Deploy create repos for you. Here is how to make one.",
      "guide.s1.h": "Open the token page",
      "guide.s1.p": 'Go to <a href="https://github.com/settings/tokens/new?description=Noisy%20Deploy&scopes=repo" target="_blank" rel="noopener noreferrer">GitHub → Settings → Tokens (classic)</a> and click <b>Generate new token (classic)</b>. Our link pre-fills the settings for you.',
      "guide.s2.h": "Name it and set an expiry",
      "guide.s2.p": "Type a note like “Noisy Deploy” so you remember what it is for, then pick an expiry date that suits you.",
      "guide.s3.h": "Tick the <code>repo</code> scope",
      "guide.s3.p": "This is the important one. Check the box labelled <b>repo</b>. That single permission lets the tool create your repository, upload files, and turn on Pages.",
      "guide.s3.note": "Only the <code>repo</code> scope is needed. You can leave everything else unchecked.",
      "guide.s4.h": "Generate, copy, paste",
      "guide.s4.p": "Click <b>Generate token</b>, copy the string that appears (GitHub shows it only once), then paste it into the Connect step above.",
      "guide.cta": "Create my token",
      "guide.safety": "Noisy Deploy never sends your token anywhere except GitHub, and you can revoke it any time from the same settings page.",

      /* faq */
      "faq.h": "Questions worth asking",
      "faq.q1": "How do I get a GitHub token?",
      "faq.a1": 'See the <a href="#guide">four-step guide</a> above, or <a href="https://github.com/settings/tokens/new?description=Noisy%20Deploy&scopes=repo" target="_blank" rel="noopener noreferrer">create a token</a> now. You only need the <code>repo</code> scope.',
      "faq.q2": "Is my token safe here?",
      "faq.a2": 'There is no server in this picture. Your token is kept in your browser’s <code>localStorage</code> and is only ever sent to <code>api.github.com</code> over HTTPS. Press <b>Forget</b> to erase it, and you can <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">revoke it on GitHub</a> at any time.',
      "faq.q3": "Public or private repository?",
      "faq.a3": "GitHub Pages needs a public repository on the free plan, so Noisy Deploy creates public repos by default. Anything you deploy will be publicly readable.",
      "faq.q4": "What actually gets deployed?",
      "faq.a4": "Your files, exactly as they are. If there is an <code>index.html</code> at the top level, it becomes the homepage. Folder structure is preserved, so <code>about/index.html</code> becomes <code>/about/</code>.",
      "faq.q5": "Can I redeploy the same project?",
      "faq.a5": "Yes. Use the same project name and Noisy Deploy commits over the existing repository instead of failing. The first build can take a minute; later ones are quick.",

      /* team */
      "team.h": "The people behind it",
      "team.sub": "Built and looked after by a small crew. Say hi on Telegram.",
      "team.dev.role": "Developer",
      "team.support.role": "Support System",
      "team.telegram": "Message on Telegram",

      /* footer */
      "foot.tagline": "Ship static sites to GitHub Pages without leaving the browser.",
      "foot.deploy": "Deploy",
      "foot.how": "How it works",
      "foot.guide": "Token guide",
      "foot.faq": "FAQ",
      "foot.team": "Team",
      "foot.tokens": "Manage tokens",
      "foot.fine": "Not affiliated with GitHub. Reimagined from a Telegram deploy bot into something you can use in a tab.",

      /* connection chip */
      "conn.notConnected": "Not connected",
      "conn.forget": "Forget",

      /* a11y */
      "a11y.showToken": "Show token",
      "a11y.hideToken": "Hide token",
      "a11y.removeFile": "Remove",
      "a11y.removeFilePath": "Remove {path}",

      /* busy button labels */
      "btn.checking": "Checking",
      "btn.deploying": "Deploying",

      /* dynamic: rate + files + idle + success note */
      "rate.left": "{n} left",
      "rate.title": "GitHub API requests left this hour: {n}",
      "rate.of": " of {limit}",
      "files.count": "{n} file{s}",
      "files.noIndex": "No index.html at the top level. GitHub Pages needs one to show a homepage.",
      "idle.waiting": "Waiting to deploy. Connect, add files, then run it.",
      "idle.recent": "Recent deploys",
      "success.built": "Your site is live on GitHub Pages.",
      "success.building": "Deployed. The first build can take a minute, then your link goes live.",

      /* dynamic: toasts + inline errors */
      "toast.connectedAs": "Connected as {login}",
      "toast.forgotten": "Token forgotten. It is gone from this browser.",
      "toast.savedInvalid": "Saved token was invalid, so it was cleared.",
      "toast.filesAdded": "{n} file{s} added",
      "toast.fileTooLarge": "A file is too large to upload from the browser: {path}",
      "toast.secretSkipped": "Skipped {n} file(s) that contain a secret (API key or token), so the deploy can succeed: {files}",
      "toast.linkCopied": "Link copied",
      "toast.copyFailed": "Could not copy. Long-press or select the link.",
      "toast.deployedLive": "Deployed and live",
      "toast.deployedBuilding": "Deployed. Building now.",
      "err.pasteToken": "Paste a token first.",
      "err.connectGeneric": "Could not connect.",
      "err.nameProject": "Give your project a name.",
      "err.addFile": "Add at least one file first.",
      "err.noIndex": "No index.html found at the top level. GitHub Pages needs one, or the site URL shows a 404. Add an index.html, or press Deploy again to publish anyway.",
      "err.unbuilt": "This looks like a raw {fw} project that hasn't been built. Browsers can't run source files like src/main.jsx, so the page loads blank. Fix it in your {fw} project: set base to your repo name in vite.config (e.g. base: '/repo-name/'), run npm run build, then deploy the contents of the dist/ folder here — not the project folder. Or press Deploy again to publish it as-is.",
      "err.unbuiltToast": "Looks like an un-built {fw} project. Deploy the dist/ folder instead.",
      "err.deployFailed": "Deploy failed.",

      /* dynamic: deploy pipeline log + GitHub errors */
      "log.auth": "Authenticating with GitHub",
      "log.signedIn": "Signed in as {owner}",
      "log.creatingRepo": "Creating repository “{repo}”",
      "log.repoCreated": "Repository created",
      "log.repoExists": "“{repo}” already exists on your account, updating it",
      "log.uploading": "Uploading {n} file{s}",
      "log.buildingCommit": "Building commit",
      "log.committed": "Committed to {branch}",
      "log.enablingPages": "Enabling GitHub Pages",
      "log.pagesEnabled": "Pages enabled",
      "log.pagesAlready": "Pages was already enabled",
      "log.waitingBuild": "Waiting for the first build (this can take a minute)",
      "log.buildStatus": "  build status: {status}",
      "log.siteLive": "Site is live",
      "log.stillBuilding": "Still building. Your link will work shortly.",
      "err.network": "Network error. Check your connection and try again.",
      "err.401": "That token is invalid or expired. Check it and try again.",
      "err.403.rate": "GitHub rate limit reached. Wait a bit and retry.",
      "err.403.generic": "GitHub refused this request. Your token may lack the repo scope, or SSO needs authorizing.",
      "err.404": "Not found. The token may lack access to this resource.",
      "err.422": "GitHub rejected the request (validation error).",
      "err.default": "GitHub returned an error ({status}).",
      "err.pagesPublic": "Could not enable Pages. A public repository is required on the free plan.",
      "err.pagesFailed": "The Pages build failed. Open the repository’s Pages settings to see why.",
      "err.secret": "GitHub blocked the push: one of your files contains a secret (an API key or token). Remove that file (or the secret inside it) and deploy again. Tip: don’t upload folders like a backend or old project that hold real keys.",

      /* --- pricing / premium / quota / payment (Phase 2) --- */
      "nav.pricing": "Pricing",
      "foot.pricing": "Pricing",

      /* announcement bar */
      "announce.dismiss": "Dismiss announcement",

      /* quota banner (deploy console) */
      "quota.checking": "Checking your plan…",
      "quota.free": "{n} of {limit} free deploys left",
      "quota.none": "You have used all {limit} free deploys.",
      "quota.premium": "Premium: unlimited deploys",
      "quota.premiumUntil": "Premium active until {date}",
      "quota.developer": "Developer: unlimited deploys",
      "quota.disabled": "Running without an account backend, so deploy limits are off.",
      "quota.upgrade": "Upgrade",
      "err.quotaReached": "You have reached the free limit of {limit} deploys. Upgrade to Premium for unlimited deploys.",

      /* pricing section */
      "pricing.h": "Go unlimited with Premium",
      "pricing.sub": "Free gives you {limit} deploys to try things out. Premium lifts the limit and adds more.",
      "pricing.note": "No card needed. Pay by bank transfer, and our team activates your Premium after checking your proof.",
      "pricing.per": "/month",
      "pricing.off": "{pct}% off",
      "pricing.free.name": "Free",
      "pricing.free.tagline": "To try it out",
      "pricing.free.f1": "{limit} deploys total",
      "pricing.free.f2": "Public repositories",
      "pricing.free.f3": "Deploy log and local history",
      "pricing.free.cta": "Your current plan",
      "pricing.premium.name": "Premium",
      "pricing.premium.tagline": "For people who ship a lot",
      "pricing.premium.f1": "Unlimited deploys",
      "pricing.premium.f2": "Deploy to private repositories",
      "pricing.premium.f3": "Early access to new features",
      "pricing.premium.f4": "Deploy history synced across devices",
      "pricing.premium.f5": "Larger file size limit",
      "pricing.premium.f6": "Premium badge on your profile",
      "pricing.premium.f7": "Priority support on Telegram",
      "pricing.premium.cta": "Upgrade to Premium",
      "pricing.premium.current": "You are Premium",

      /* payment modal */
      "pay.title": "Upgrade to Premium",
      "pay.intro": "Transfer the amount, upload your proof, then confirm on Telegram. We activate Premium once we have checked it.",
      "pay.needLogin": "Connect your GitHub first so we can attach Premium to your account.",
      "pay.step1": "1. Transfer",
      "pay.amount": "Amount",
      "pay.bank": "Bank",
      "pay.account": "Account number",
      "pay.holder": "Account name",
      "pay.copy": "Copy",
      "pay.copied": "Copied to clipboard",
      "pay.step2": "2. Upload your proof",
      "pay.proofHint": "A screenshot of the transfer. Image only, up to 5 MB.",
      "pay.chooseProof": "Choose image",
      "pay.proofSelected": "Selected: {name}",
      "pay.step3": "3. Confirm on Telegram",
      "pay.confirmHint": "Send your proof to us on Telegram so we can activate Premium.",
      "pay.confirm": "Confirm on Telegram",
      "pay.confirmVia": "This payment will be confirmed with our {via} on Telegram.",
      "pay.viaDev": "Developer",
      "pay.viaSupport": "Support",
      "pay.uploading": "Uploading proof…",
      "pay.submitted": "Proof uploaded. Now confirm on Telegram to finish.",
      "pay.needProof": "Upload your transfer proof first.",
      "pay.uploadFailed": "Could not upload your proof. Please try again.",
      "pay.disabled": "Upgrades are not available right now. Please contact us on Telegram.",
      "pay.close": "Close",
      "pay.telegramMsg": "Hi, I just upgraded to Noisy Deploy Premium.\nGitHub: {login}\nAmount: {amount}\nProof: {proof}\nPlease activate my Premium. Thank you!",
      "pay.plan": "Plan",
      "pay.pickMethod": "Choose how you want to pay:",
      "pay.legal": "By upgrading you agree to our <a href=\"terms.html\">Terms of Service</a> and <a href=\"privacy.html\">Privacy Policy</a>.",
      "foot.terms": "Terms of Service",
      "foot.privacy": "Privacy Policy",
      "period.day": "/day",
      "period.week": "/week",
      "period.month": "/month",
      "period.quarter": "/quarter",
      "period.year": "/year",
      "period.lifetime": "/lifetime",
      "period.daily": "/day",
      "period.weekly": "/week",
      "period.monthly": "/month",
      "period.quarterly": "/quarter",
      "period.yearly": "/year",
      "period.annual": "/year",
      "pricing.upgradeTo": "Upgrade to {name}",
      "legal.back": "Back to app",
      "legal.updated": "Last updated: 19 August 2026",
      "legal.terms.title": "Terms of Service",
      "legal.terms.body": "<p>Welcome to Noisy Deploy. By using this site you agree to these terms. Please read them.</p>" +
        "<h2>1. What Noisy Deploy does</h2><p>Noisy Deploy is a tool that runs in your browser and helps you publish static websites to GitHub Pages using your own GitHub account. It is not affiliated with, endorsed by, or operated by GitHub.</p>" +
        "<h2>2. Your GitHub token</h2><p>You provide a GitHub personal access token. That token is stored only in your browser (localStorage) on your own device and is sent only to api.github.com over HTTPS. We never receive or store it on any server. You can revoke it at any time from your GitHub settings.</p>" +
        "<h2>3. What you deploy</h2><p>Repositories are created public so GitHub Pages works on the free plan, so anything you deploy is publicly readable. You are responsible for the content you publish and must have the right to publish it. Do not deploy unlawful, infringing, or harmful content.</p>" +
        "<h2>4. Free limit and Premium</h2><p>Free use is limited to a number of deploys tracked per account and per network. To count deploys per network we store only a salted, one-way hash of your IP address, never the raw address. Premium removes the limit. Premium is sold manually: you transfer the amount, upload proof, and we activate your account after a human reviews it. There is no automatic payment gateway.</p>" +
        "<h2>5. Payments and refunds</h2><p>Prices are shown in the pricing section and may change. Because activation is manual, please allow time for review. Contact us on Telegram if a payment is not activated. Refunds are handled case by case.</p>" +
        "<h2>6. No warranty</h2><p>The service is provided \"as is\", without warranty of any kind. We do not guarantee that deploys will always succeed or that the service will be uninterrupted. GitHub's own terms and rate limits apply to your account.</p>" +
        "<h2>7. Limitation of liability</h2><p>To the extent permitted by law, we are not liable for any loss arising from your use of the service, including lost data or content published through your account.</p>" +
        "<h2>8. Changes</h2><p>We may update these terms. Continued use after a change means you accept the updated terms.</p>" +
        "<h2>9. Contact</h2><p>Reach us on Telegram at @noisy05 (developer) or @bloodskil2 (support).</p>",
      "legal.privacy.title": "Privacy Policy",
      "legal.privacy.body": "<p>This policy explains what Noisy Deploy collects and why. We keep it minimal on purpose.</p>" +
        "<h2>1. Your GitHub token</h2><p>Your token stays in your browser's localStorage on your device. It is sent only to api.github.com to perform the deploys you ask for. We do not receive, log, or store it.</p>" +
        "<h2>2. IP address (hashed)</h2><p>To enforce the free deploy limit fairly across a network, we store a salted, one-way hash of your IP address together with a deploy counter. We cannot recover your real IP from this hash. We do not use it for tracking or advertising.</p>" +
        "<h2>3. Account and deploy records</h2><p>When you use accounts we store your GitHub login, your plan, deploy count, and a log of successful deploys (repo name and URL). This lets us apply your quota and Premium.</p>" +
        "<h2>4. Payments</h2><p>If you buy Premium, we store the proof image you upload, the amount, the chosen method, and the plan, so we can review and activate it. Do not upload more personal data than necessary in the proof.</p>" +
        "<h2>5. Processors</h2><p>Data is stored with Supabase (database and file storage) and served over GitHub Pages or similar static hosting. GitHub processes your deploys under its own privacy policy.</p>" +
        "<h2>6. Your choices</h2><p>Use \"Forget token\" to wipe your token from this device. You can revoke the token on GitHub at any time. Contact us to ask about deleting your account record.</p>" +
        "<h2>7. Contact</h2><p>Reach us on Telegram at @noisy05 (developer) or @bloodskil2 (support).</p>",

      /* plan badges */
      "badge.premium": "PREMIUM",
      "badge.developer": "DEV",
    },

    id: {
      /* meta */
      "meta.title": "Noisy Deploy: kirim situs apa pun ke GitHub Pages langsung dari browser",

      /* nav */
      "nav.how": "Cara kerja",
      "nav.guide": "Panduan token",
      "nav.faq": "Tanya jawab",
      "nav.team": "Tim",
      "nav.lang": "Bahasa",
      "nav.menu": "Menu",

      /* hero */
      "hero.sub": "Taruh file-mu, tempel token, dapat link langsung. Situsmu langsung tayang ke GitHub Pages dari browser.",
      "hero.cta.start": "Mulai deploy",
      "hero.cta.token": "Cara dapat token",
      "hero.fact1": "<b>Tanpa terminal.</b> Tanpa perintah git.",
      "hero.fact2": "<b>Tanpa server.</b> Token-mu tak pernah keluar dari browser.",
      "hero.fact3": "<b>Tanpa proses build.</b> File statis tayang apa adanya.",

      /* console */
      "console.h": "Konsol deploy",
      "console.sub": "Empat langkah. Yang terakhir cuma menonton situsmu tayang.",
      "stepper.aria": "Progres deploy",
      "step.connect": "Hubungkan",
      "step.files": "File",
      "step.config": "Atur",
      "step.deploy": "Deploy",

      /* connect panel */
      "connect.h": "Hubungkan GitHub-mu",
      "connect.p": "Tempel personal access token dengan scope <code>repo</code>. Token disimpan hanya di browser ini dan hanya dikirim ke GitHub.",
      "connect.label": "Token GitHub",
      "connect.placeholder": "ghp_… atau github_pat_…",
      "connect.hint": 'Belum punya? <a href="https://github.com/settings/tokens/new?description=Noisy%20Deploy&scopes=repo" target="_blank" rel="noopener noreferrer">Buat token dengan scope yang tepat</a>, atau baca <a href="#guide">panduan langkah demi langkah</a>.',
      "connect.btn": "Hubungkan",
      "connect.continue": "Lanjut",
      "connect.forgetToken": "Lupakan token",
      "connect.privacy": "Token-mu ada di <code>localStorage</code> di perangkat ini saja. Pakai <b>Lupakan</b> untuk menghapusnya.",

      /* files panel */
      "files.h": "Tambahkan file-mu",
      "files.p": "Taruh folder atau pilih file. HTML, CSS, JS, gambar, font. Semuanya.",
      "files.dzAria": "Taruh file di sini, atau tekan Enter untuk memilih file",
      "files.dzTitle": "Seret & taruh situsmu di sini",
      "files.or": "atau",
      "files.chooseFiles": "Pilih file",
      "files.chooseFolder": "Pilih folder",
      "files.clearAll": "Hapus semua",
      "files.preview": "Pratinjau <code>index.html</code>",
      "files.back": "Kembali",
      "files.continue": "Lanjut",

      /* config panel */
      "config.h": "Beri nama proyekmu",
      "config.p": "Ini jadi nama repositori dan bagian akhir dari URL-mu.",
      "config.label.name": "Nama proyek",
      "config.namePlaceholder": "situs-keren-saya",
      "config.urlPrefix": "Situsmu akan tayang di",
      "config.label.desc": "Deskripsi <span class=\"opt\">(opsional)</span>",
      "config.descPlaceholder": "Situs kecil buatan saya",
      "config.note": "Repositori dibuat <b>publik</b> agar GitHub Pages jalan di paket gratis. Memakai nama yang sama akan memperbarui proyek itu.",
      "config.back": "Kembali",
      "config.deploy": "Deploy sekarang",

      /* success panel */
      "success.h": "Sudah tayang",
      "success.open": "Buka situs",
      "success.copy": "Salin link",
      "success.repo": "Lihat repo",
      "success.another": "Deploy lagi",

      /* log */
      "log.title": "log deploy",

      /* how it works */
      "how.h": "Tiga langkah sampai tayang",
      "how.sub": "Sesederhana perintah chat, jalan seperti pipeline.",
      "how.s1.h": "Hubungkan",
      "how.s1.p": "Tempel token GitHub sekali. Token tetap di perangkatmu dan hanya bicara ke GitHub.",
      "how.s2.h": "Taruh file",
      "how.s2.p": "Tambah satu halaman atau seluruh folder. Gambar dan font ikut serta.",
      "how.s3.h": "Deploy",
      "how.s3.p": "Repo dibuat, file-mu di-commit, dan Pages diaktifkan. Kamu dapat link.",

      /* guide (token tutorial) */
      "guide.h": "Hubungkan ke GitHub dalam empat langkah",
      "guide.sub": "Token itu seperti kunci sementara yang mengizinkan Noisy Deploy membuat repo untukmu. Begini cara membuatnya.",
      "guide.s1.h": "Buka halaman token",
      "guide.s1.p": 'Buka <a href="https://github.com/settings/tokens/new?description=Noisy%20Deploy&scopes=repo" target="_blank" rel="noopener noreferrer">GitHub → Settings → Tokens (classic)</a> lalu klik <b>Generate new token (classic)</b>. Link kami sudah mengisi pengaturannya untukmu.',
      "guide.s2.h": "Beri nama dan atur masa berlaku",
      "guide.s2.p": "Tulis catatan seperti “Noisy Deploy” biar kamu ingat kegunaannya, lalu pilih tanggal kedaluwarsa yang cocok.",
      "guide.s3.h": "Centang scope <code>repo</code>",
      "guide.s3.p": "Ini yang penting. Centang kotak berlabel <b>repo</b>. Satu izin ini memungkinkan alat membuat repositori, mengunggah file, dan menyalakan Pages.",
      "guide.s3.note": "Cukup scope <code>repo</code> saja. Yang lain boleh dibiarkan tidak dicentang.",
      "guide.s4.h": "Generate, salin, tempel",
      "guide.s4.p": "Klik <b>Generate token</b>, salin teks yang muncul (GitHub hanya menampilkannya sekali), lalu tempel ke langkah Hubungkan di atas.",
      "guide.cta": "Buat token saya",
      "guide.safety": "Noisy Deploy tak pernah mengirim token-mu ke mana pun selain GitHub, dan kamu bisa mencabutnya kapan saja dari halaman pengaturan yang sama.",

      /* faq */
      "faq.h": "Pertanyaan yang sering muncul",
      "faq.q1": "Bagaimana cara mendapatkan token GitHub?",
      "faq.a1": 'Lihat <a href="#guide">panduan empat langkah</a> di atas, atau <a href="https://github.com/settings/tokens/new?description=Noisy%20Deploy&scopes=repo" target="_blank" rel="noopener noreferrer">buat token</a> sekarang. Kamu cukup butuh scope <code>repo</code>.',
      "faq.q2": "Apakah token saya aman di sini?",
      "faq.a2": 'Tidak ada server di sini. Token-mu disimpan di <code>localStorage</code> browser-mu dan hanya dikirim ke <code>api.github.com</code> lewat HTTPS. Tekan <b>Lupakan</b> untuk menghapusnya, dan kamu bisa <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">mencabutnya di GitHub</a> kapan saja.',
      "faq.q3": "Repositori publik atau privat?",
      "faq.a3": "GitHub Pages butuh repositori publik di paket gratis, jadi Noisy Deploy membuat repo publik secara default. Apa pun yang kamu deploy bisa dibaca publik.",
      "faq.q4": "Apa saja yang di-deploy?",
      "faq.a4": "File-mu, persis apa adanya. Jika ada <code>index.html</code> di tingkat atas, itu jadi beranda. Struktur folder dipertahankan, jadi <code>about/index.html</code> jadi <code>/about/</code>.",
      "faq.q5": "Bisakah saya deploy ulang proyek yang sama?",
      "faq.a5": "Bisa. Pakai nama proyek yang sama dan Noisy Deploy akan commit menimpa repositori yang ada, bukan gagal. Build pertama bisa satu menit; berikutnya cepat.",

      /* team */
      "team.h": "Orang di balik ini",
      "team.sub": "Dibuat dan dijaga oleh tim kecil. Sapa kami di Telegram.",
      "team.dev.role": "Developer",
      "team.support.role": "Support System",
      "team.telegram": "Kirim pesan di Telegram",

      /* footer */
      "foot.tagline": "Kirim situs statis ke GitHub Pages tanpa keluar dari browser.",
      "foot.deploy": "Deploy",
      "foot.how": "Cara kerja",
      "foot.guide": "Panduan token",
      "foot.faq": "Tanya jawab",
      "foot.team": "Tim",
      "foot.tokens": "Kelola token",
      "foot.fine": "Tidak berafiliasi dengan GitHub. Diubah dari bot deploy Telegram jadi sesuatu yang bisa kamu pakai di tab browser.",

      /* connection chip */
      "conn.notConnected": "Belum terhubung",
      "conn.forget": "Lupakan",

      /* a11y */
      "a11y.showToken": "Tampilkan token",
      "a11y.hideToken": "Sembunyikan token",
      "a11y.removeFile": "Hapus",
      "a11y.removeFilePath": "Hapus {path}",

      /* busy button labels */
      "btn.checking": "Memeriksa",
      "btn.deploying": "Men-deploy",

      /* dynamic: rate + files + idle + success note */
      "rate.left": "{n} tersisa",
      "rate.title": "Sisa permintaan API GitHub jam ini: {n}",
      "rate.of": " dari {limit}",
      "files.count": "{n} file",
      "files.noIndex": "Tidak ada index.html di tingkat atas. GitHub Pages perlu itu untuk menampilkan beranda.",
      "idle.waiting": "Menunggu deploy. Hubungkan, tambah file, lalu jalankan.",
      "idle.recent": "Deploy terakhir",
      "success.built": "Situsmu sudah tayang di GitHub Pages.",
      "success.building": "Sudah di-deploy. Build pertama bisa satu menit, lalu link-mu tayang.",

      /* dynamic: toasts + inline errors */
      "toast.connectedAs": "Terhubung sebagai {login}",
      "toast.forgotten": "Token dilupakan. Sudah hilang dari browser ini.",
      "toast.savedInvalid": "Token tersimpan tidak valid, jadi dihapus.",
      "toast.filesAdded": "{n} file ditambahkan",
      "toast.fileTooLarge": "Ada file yang terlalu besar untuk diunggah dari browser: {path}",
      "toast.secretSkipped": "Melewati {n} file yang berisi rahasia (API key atau token) supaya deploy berhasil: {files}",
      "toast.linkCopied": "Link disalin",
      "toast.copyFailed": "Tidak bisa menyalin. Tekan lama atau pilih link-nya.",
      "toast.deployedLive": "Sudah di-deploy dan tayang",
      "toast.deployedBuilding": "Sudah di-deploy. Sedang membangun.",
      "err.pasteToken": "Tempel token dulu.",
      "err.connectGeneric": "Tidak bisa terhubung.",
      "err.nameProject": "Beri nama proyekmu.",
      "err.addFile": "Tambahkan minimal satu file dulu.",
      "err.noIndex": "Tidak ada index.html di tingkat teratas. GitHub Pages membutuhkannya, kalau tidak URL situs akan menampilkan 404. Tambahkan index.html, atau tekan Deploy lagi untuk tetap menerbitkannya.",
      "err.unbuilt": "Ini sepertinya proyek {fw} mentah yang belum di-build. Browser tidak bisa menjalankan file source seperti src/main.jsx, jadi halaman tampil kosong. Perbaiki di proyek {fw}-mu: set base ke nama repo di vite.config (mis. base: '/nama-repo/'), jalankan npm run build, lalu deploy isi folder dist/ ke sini — bukan folder proyeknya. Atau tekan Deploy lagi untuk tetap menerbitkannya apa adanya.",
      "err.unbuiltToast": "Sepertinya proyek {fw} yang belum di-build. Deploy folder dist/-nya.",
      "err.deployFailed": "Deploy gagal.",

      /* dynamic: deploy pipeline log + GitHub errors */
      "log.auth": "Mengautentikasi dengan GitHub",
      "log.signedIn": "Masuk sebagai {owner}",
      "log.creatingRepo": "Membuat repositori “{repo}”",
      "log.repoCreated": "Repositori dibuat",
      "log.repoExists": "“{repo}” sudah ada di akunmu, memperbaruinya",
      "log.uploading": "Mengunggah {n} file",
      "log.buildingCommit": "Menyusun commit",
      "log.committed": "Di-commit ke {branch}",
      "log.enablingPages": "Mengaktifkan GitHub Pages",
      "log.pagesEnabled": "Pages diaktifkan",
      "log.pagesAlready": "Pages sudah aktif sebelumnya",
      "log.waitingBuild": "Menunggu build pertama (bisa sampai satu menit)",
      "log.buildStatus": "  status build: {status}",
      "log.siteLive": "Situs sudah tayang",
      "log.stillBuilding": "Masih membangun. Link-mu akan aktif sebentar lagi.",
      "err.network": "Galat jaringan. Periksa koneksimu lalu coba lagi.",
      "err.401": "Token itu tidak valid atau kedaluwarsa. Periksa lalu coba lagi.",
      "err.403.rate": "Batas permintaan GitHub tercapai. Tunggu sebentar lalu coba lagi.",
      "err.403.generic": "GitHub menolak permintaan ini. Token-mu mungkin tak punya scope repo, atau SSO perlu diotorisasi.",
      "err.404": "Tidak ditemukan. Token mungkin tak punya akses ke sumber ini.",
      "err.422": "GitHub menolak permintaan (galat validasi).",
      "err.default": "GitHub mengembalikan galat ({status}).",
      "err.pagesPublic": "Tidak bisa mengaktifkan Pages. Paket gratis butuh repositori publik.",
      "err.pagesFailed": "Build Pages gagal. Buka pengaturan Pages di repositori untuk melihat sebabnya.",
      "err.secret": "GitHub memblokir push: salah satu file-mu berisi rahasia (API key atau token). Hapus file itu (atau rahasianya) lalu deploy lagi. Tips: jangan unggah folder seperti backend atau proyek lama yang menyimpan key asli.",

      /* --- pricing / premium / quota / payment (Phase 2) --- */
      "nav.pricing": "Harga",
      "foot.pricing": "Harga",

      /* announcement bar */
      "announce.dismiss": "Tutup pengumuman",

      /* quota banner (deploy console) */
      "quota.checking": "Memeriksa paketmu…",
      "quota.free": "Sisa {n} dari {limit} deploy gratis",
      "quota.none": "Kamu sudah memakai semua {limit} deploy gratis.",
      "quota.premium": "Premium: deploy tanpa batas",
      "quota.premiumUntil": "Premium aktif sampai {date}",
      "quota.developer": "Developer: deploy tanpa batas",
      "quota.disabled": "Berjalan tanpa backend akun, jadi batas deploy dimatikan.",
      "quota.upgrade": "Upgrade",
      "err.quotaReached": "Kamu sudah mencapai batas gratis {limit} deploy. Upgrade ke Premium untuk deploy tanpa batas.",

      /* pricing section */
      "pricing.h": "Tanpa batas dengan Premium",
      "pricing.sub": "Gratis memberimu {limit} deploy untuk mencoba. Premium menghapus batas dan menambah fitur.",
      "pricing.note": "Tanpa kartu. Bayar lewat transfer bank, lalu tim kami mengaktifkan Premium setelah memeriksa buktimu.",
      "pricing.per": "/bulan",
      "pricing.off": "diskon {pct}%",
      "pricing.free.name": "Gratis",
      "pricing.free.tagline": "Untuk mencoba",
      "pricing.free.f1": "{limit} deploy total",
      "pricing.free.f2": "Repositori publik",
      "pricing.free.f3": "Log deploy dan riwayat lokal",
      "pricing.free.cta": "Paketmu saat ini",
      "pricing.premium.name": "Premium",
      "pricing.premium.tagline": "Untuk yang sering deploy",
      "pricing.premium.f1": "Deploy tanpa batas",
      "pricing.premium.f2": "Deploy ke repositori privat",
      "pricing.premium.f3": "Akses awal ke fitur baru",
      "pricing.premium.f4": "Riwayat deploy tersinkron di semua perangkat",
      "pricing.premium.f5": "Batas ukuran file lebih besar",
      "pricing.premium.f6": "Lencana Premium di profilmu",
      "pricing.premium.f7": "Dukungan prioritas di Telegram",
      "pricing.premium.cta": "Upgrade ke Premium",
      "pricing.premium.current": "Kamu sudah Premium",

      /* payment modal */
      "pay.title": "Upgrade ke Premium",
      "pay.intro": "Transfer nominalnya, unggah buktimu, lalu konfirmasi di Telegram. Kami aktifkan Premium setelah memeriksanya.",
      "pay.needLogin": "Hubungkan GitHub-mu dulu agar Premium bisa dipasang ke akunmu.",
      "pay.step1": "1. Transfer",
      "pay.amount": "Nominal",
      "pay.bank": "Bank",
      "pay.account": "Nomor rekening",
      "pay.holder": "Atas nama",
      "pay.copy": "Salin",
      "pay.copied": "Disalin ke papan klip",
      "pay.step2": "2. Unggah buktimu",
      "pay.proofHint": "Tangkapan layar transfer. Hanya gambar, maksimal 5 MB.",
      "pay.chooseProof": "Pilih gambar",
      "pay.proofSelected": "Dipilih: {name}",
      "pay.step3": "3. Konfirmasi di Telegram",
      "pay.confirmHint": "Kirim buktimu ke kami di Telegram agar Premium bisa diaktifkan.",
      "pay.confirm": "Konfirmasi di Telegram",
      "pay.confirmVia": "Pembayaran ini akan dikonfirmasi ke {via} kami di Telegram.",
      "pay.viaDev": "Developer",
      "pay.viaSupport": "Support",
      "pay.uploading": "Mengunggah bukti…",
      "pay.submitted": "Bukti terunggah. Sekarang konfirmasi di Telegram untuk menyelesaikan.",
      "pay.needProof": "Unggah bukti transfermu dulu.",
      "pay.uploadFailed": "Tidak bisa mengunggah buktimu. Coba lagi.",
      "pay.disabled": "Upgrade belum tersedia saat ini. Silakan hubungi kami di Telegram.",
      "pay.close": "Tutup",
      "pay.telegramMsg": "Halo, saya baru upgrade ke Noisy Deploy Premium.\nGitHub: {login}\nNominal: {amount}\nBukti: {proof}\nMohon aktifkan Premium saya. Terima kasih!",
      "pay.plan": "Paket",
      "pay.pickMethod": "Pilih cara pembayaranmu:",
      "pay.legal": "Dengan melakukan upgrade, kamu menyetujui <a href=\"terms.html\">Ketentuan Layanan</a> dan <a href=\"privacy.html\">Kebijakan Privasi</a> kami.",
      "foot.terms": "Ketentuan Layanan",
      "foot.privacy": "Kebijakan Privasi",
      "period.day": "/hari",
      "period.week": "/minggu",
      "period.month": "/bulan",
      "period.quarter": "/kuartal",
      "period.year": "/tahun",
      "period.lifetime": "/selamanya",
      "period.daily": "/hari",
      "period.weekly": "/minggu",
      "period.monthly": "/bulan",
      "period.quarterly": "/kuartal",
      "period.yearly": "/tahun",
      "period.annual": "/tahun",
      "pricing.upgradeTo": "Upgrade ke {name}",
      "legal.back": "Kembali ke aplikasi",
      "legal.updated": "Terakhir diperbarui: 19 Agustus 2026",
      "legal.terms.title": "Ketentuan Layanan",
      "legal.terms.body": "<p>Selamat datang di Noisy Deploy. Dengan menggunakan situs ini kamu menyetujui ketentuan berikut. Mohon dibaca.</p>" +
        "<h2>1. Apa itu Noisy Deploy</h2><p>Noisy Deploy adalah alat yang berjalan di browser dan membantu kamu mempublikasikan situs statis ke GitHub Pages memakai akun GitHub-mu sendiri. Kami tidak berafiliasi dengan, tidak didukung oleh, dan tidak dijalankan oleh GitHub.</p>" +
        "<h2>2. Token GitHub-mu</h2><p>Kamu memasukkan personal access token GitHub. Token itu hanya disimpan di browser (localStorage) pada perangkatmu dan hanya dikirim ke api.github.com melalui HTTPS. Kami tidak pernah menerima atau menyimpannya di server mana pun. Kamu bisa mencabutnya kapan saja dari pengaturan GitHub.</p>" +
        "<h2>3. Yang kamu deploy</h2><p>Repositori dibuat publik agar GitHub Pages bisa jalan di paket gratis, sehingga apa pun yang kamu deploy dapat dibaca publik. Kamu bertanggung jawab atas konten yang kamu publikasikan dan harus punya hak untuk mempublikasikannya. Jangan deploy konten melanggar hukum, melanggar hak cipta, atau berbahaya.</p>" +
        "<h2>4. Batas gratis dan Premium</h2><p>Penggunaan gratis dibatasi sejumlah deploy yang dihitung per akun dan per jaringan. Untuk menghitung per jaringan kami hanya menyimpan hash satu arah ber-salt dari alamat IP-mu, bukan alamat aslinya. Premium menghapus batas ini. Premium dijual manual: kamu transfer nominalnya, unggah bukti, lalu kami aktifkan setelah diperiksa manusia. Tidak ada gerbang pembayaran otomatis.</p>" +
        "<h2>5. Pembayaran dan pengembalian dana</h2><p>Harga ditampilkan di bagian harga dan dapat berubah. Karena aktivasi manual, mohon beri waktu untuk peninjauan. Hubungi kami di Telegram bila pembayaran belum aktif. Pengembalian dana ditangani per kasus.</p>" +
        "<h2>6. Tanpa jaminan</h2><p>Layanan disediakan \"apa adanya\", tanpa jaminan apa pun. Kami tidak menjamin deploy selalu berhasil atau layanan tanpa gangguan. Ketentuan dan batas laju GitHub berlaku pada akunmu.</p>" +
        "<h2>7. Batasan tanggung jawab</h2><p>Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian akibat penggunaan layanan, termasuk hilangnya data atau konten yang dipublikasikan melalui akunmu.</p>" +
        "<h2>8. Perubahan</h2><p>Kami dapat memperbarui ketentuan ini. Penggunaan yang berlanjut setelah perubahan berarti kamu menerimanya.</p>" +
        "<h2>9. Kontak</h2><p>Hubungi kami di Telegram @noisy05 (developer) atau @bloodskil2 (support).</p>",
      "legal.privacy.title": "Kebijakan Privasi",
      "legal.privacy.body": "<p>Kebijakan ini menjelaskan apa yang dikumpulkan Noisy Deploy dan alasannya. Kami sengaja membuatnya seminimal mungkin.</p>" +
        "<h2>1. Token GitHub-mu</h2><p>Token-mu tetap di localStorage browser pada perangkatmu. Ia hanya dikirim ke api.github.com untuk menjalankan deploy yang kamu minta. Kami tidak menerima, mencatat, atau menyimpannya.</p>" +
        "<h2>2. Alamat IP (di-hash)</h2><p>Untuk menerapkan batas deploy gratis secara adil per jaringan, kami menyimpan hash satu arah ber-salt dari alamat IP-mu beserta penghitung deploy. Kami tidak bisa memulihkan IP aslimu dari hash ini. Kami tidak memakainya untuk pelacakan atau iklan.</p>" +
        "<h2>3. Catatan akun dan deploy</h2><p>Saat memakai akun, kami menyimpan login GitHub-mu, paketmu, jumlah deploy, dan log deploy yang berhasil (nama repo dan URL). Ini untuk menerapkan kuota dan Premium.</p>" +
        "<h2>4. Pembayaran</h2><p>Bila kamu membeli Premium, kami menyimpan gambar bukti yang kamu unggah, nominal, metode yang dipilih, dan paketnya, agar bisa kami tinjau dan aktifkan. Jangan mengunggah data pribadi lebih dari yang diperlukan pada bukti.</p>" +
        "<h2>5. Pemroses data</h2><p>Data disimpan di Supabase (basis data dan penyimpanan berkas) dan disajikan lewat GitHub Pages atau hosting statis serupa. GitHub memproses deploy-mu berdasarkan kebijakan privasinya sendiri.</p>" +
        "<h2>6. Pilihanmu</h2><p>Gunakan \"Lupakan token\" untuk menghapus token dari perangkat ini. Kamu bisa mencabut token di GitHub kapan saja. Hubungi kami untuk menanyakan penghapusan catatan akunmu.</p>" +
        "<h2>7. Kontak</h2><p>Hubungi kami di Telegram @noisy05 (developer) atau @bloodskil2 (support).</p>",

      /* plan badges */
      "badge.premium": "PREMIUM",
      "badge.developer": "DEV",
    },
  };

  function fill(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  }

  const i18n = {
    lang: "en",
    onChange: null,

    t(key, vars) {
      const table = dict[this.lang] || dict.en;
      let s = table[key];
      if (s == null) s = dict.en[key];
      if (s == null) return key;
      return fill(s, vars);
    },

    apply(root) {
      root = root || document;
      const self = this;
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = self.t(el.getAttribute("data-i18n"));
      });
      root.querySelectorAll("[data-i18n-html]").forEach((el) => {
        el.innerHTML = self.t(el.getAttribute("data-i18n-html"));
      });
      root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
        el.getAttribute("data-i18n-attr").split(",").forEach((pair) => {
          const bits = pair.split(":");
          const attr = (bits[0] || "").trim();
          const key = (bits[1] || "").trim();
          if (attr && key) el.setAttribute(attr, self.t(key));
        });
      });
      document.documentElement.setAttribute("lang", this.lang);
    },

    updateToggle() {
      const opts = document.querySelectorAll(".lang-opt");
      opts.forEach((b) => {
        const on = b.getAttribute("data-lang") === this.lang;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    },

    set(lang) {
      this.lang = dict[lang] ? lang : "en";
      ND.util.store(STORE_KEY, this.lang);
      this.apply();
      this.updateToggle();
      if (typeof this.onChange === "function") this.onChange(this.lang);
    },

    toggle() { this.set(this.lang === "en" ? "id" : "en"); },

    init() {
      const saved = ND.util.load(STORE_KEY);
      let lang = saved;
      if (!lang) {
        const nav = (navigator.language || "en").toLowerCase();
        lang = nav.indexOf("id") === 0 ? "id" : "en";
      }
      this.lang = dict[lang] ? lang : "en";
      this.apply();
      this.updateToggle();
    },
  };

  ND.i18n = i18n;
  ND.t = function (key, vars) { return i18n.t(key, vars); };
})(window.ND);
