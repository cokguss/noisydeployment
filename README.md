<div align="center">

# Noisy Deploy

**Kirim situs statis apa pun ke GitHub Pages langsung dari browser**

Gratis · Tanpa terminal · Tanpa build · Tanpa server

[![HTML5](https://img.shields.io/badge/HTML5-semantic-e34f26?logo=html5&logoColor=white)](https://developer.mozilla.org/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-vanilla-1572b6?logo=css3&logoColor=white)](https://developer.mozilla.org/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-no%20build-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Supabase](https://img.shields.io/badge/Supabase-accounts-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/Penggunaan-pribadi-84cc16)](#-lisensi)

</div>

---

## ✨ Fitur

| Bagian | Kemampuan |
|--------|-----------|
| **Deploy sekali klik** | Drop berkas, tempel token GitHub, dapatkan tautan live GitHub Pages |
| **Tanpa build** | HTML/CSS/JS murni — tidak ada bundler, tidak ada langkah kompilasi |
| **Akun & kuota** | Login GitHub, batas deploy gratis, dan Premium tanpa batas via Supabase |
| **Pembayaran manual** | Banyak metode (bank, e-wallet, QRIS) dengan QR, dikonfirmasi manusia |

**Fitur umum**

- 🎨 Tampilan dark-tech dengan satu aksen cyan terkunci & animasi halus
- ⏳ Intro loading animation yang muncul sekali per sesi tab
- 🌐 Dua bahasa: Indonesia & English (toggle langsung)
- 🌗 Hormati `prefers-reduced-motion`
- 📱 Responsif penuh — desktop maupun mobile
- 🛡️ Panel admin: kelola paket, metode bayar, pengguna, dan pengumuman
- 📄 Halaman Ketentuan Layanan & Kebijakan Privasi terpisah
- 🔒 Token GitHub hanya tersimpan di browser, IP disimpan ter-hash

## 🚀 Menjalankan Secara Lokal

**Prasyarat:** peramban modern (opsional: Python 3 untuk server statis)

```bash
# Sajikan folder ini lewat server statis apa pun, misalnya:
py -m http.server 8080
```

Buka **http://127.0.0.1:8080** — selesai. Panel admin ada di **/admin/**.

> ℹ️ **Kenapa perlu server statis?** Membuka `index.html` langsung dari disk (`file://`) tetap bisa untuk deploy dasar, tetapi fitur akun (Supabase) memerlukan origin `http(s)://`. Server statis apa pun sudah cukup — tidak ada langkah build.

## 🧠 Cara Kerja

```
Browser ──► Noisy Deploy (HTML/CSS/JS murni)
   │
   ├── Deploy   ──► GitHub REST API ──► repo publik + GitHub Pages
   │                (token hanya di localStorage, dikirim hanya ke api.github.com)
   │
   └── Akun     ──► Supabase (Postgres + Auth + Storage + Realtime)
                    ├── kuota & Premium  : Edge Functions + Row-Level Security
                    ├── bukti bayar      : Storage bucket (upload anon)
                    └── admin            : is_admin() gating lewat email JWT
```

**Kenapa tanpa build?** Semua berbagi satu namespace global `window.ND` lewat tag `<script>` klasik dengan urutan yang ditentukan, jadi bisa langsung disajikan sebagai berkas statis di GitHub Pages maupun Vercel tanpa bundler.

**Kenapa kunci anon aman dipublikasikan?** Kunci anon Supabase dilindungi Row-Level Security, dan seluruh logika kuota dijalankan di Edge Functions. Kunci `service_role` / `sbp_` tidak pernah ada di berkas mana pun yang disajikan ke klien.

## 📁 Struktur Proyek

```
noisy-deploy/
├── index.html            # Aplikasi utama (deploy + pricing + pay modal)
├── admin/
│   └── index.html        # Panel admin (paket, metode bayar, pengguna)
├── terms.html            # Halaman Ketentuan Layanan
├── privacy.html          # Halaman Kebijakan Privasi
├── css/
│   ├── style.css         # Token tema & seluruh gaya
│   └── animations.css    # Animasi latar & transisi
├── js/
│   ├── config.js         # Konstanta + helper murni (namespace ND)
│   ├── i18n.js           # Kamus ID/EN + engine terjemahan
│   ├── github.js         # Klien GitHub REST (deploy ke Pages)
│   ├── supabase.js       # Lapisan data tipis di atas supabase-js
│   ├── quota.js          # Kuota deploy & status Premium
│   ├── ui.js             # Render UI (pricing, modal, toast)
│   ├── app.js            # Orkestrasi alur & event
│   ├── fx.js             # Efek visual latar
│   └── admin.js          # Logika panel admin
├── supabase/
│   ├── schema.sql        # Skema tabel + RLS + Storage (reproducible)
│   ├── functions/        # Edge Functions (kuota, dsb.)
│   └── SETUP.md          # Langkah menyiapkan proyek Supabase
└── assets/               # Favicon & aset statis
```

## ☁️ Deploy ke Vercel

Aplikasi ini 100% statis, jadi bisa langsung satu deployment tanpa konfigurasi build.

1. Impor repo ini ke Vercel.
2. Biarkan pengaturan bawaan — tanpa framework preset, output langsung dari root (tanpa build command).
3. Deploy. Selesai.

> ⚠️ **Setelah deploy:** tambahkan URL Vercel (dan URL GitHub Pages jika dipakai) ke daftar **Allowed URLs** di Supabase Auth, lalu isi `SUPABASE_URL` & `SUPABASE_ANON_KEY` di `js/config.js` sesuai proyekmu (lihat `supabase/SETUP.md`). Kosongkan keduanya untuk menjalankan mode tanpa akun.

## ⚠️ Catatan

- Deploy membuat **repo publik** di akun GitHub-mu — jangan unggah berkas rahasia.
- Token GitHub hanya disimpan di `localStorage` peramban dan hanya dikirim ke `api.github.com`.
- Pembayaran bersifat manual (tanpa gateway); Premium diaktifkan setelah verifikasi manusia.
- Tidak berafiliasi dengan GitHub.

## 📄 Lisensi

Penggunaan pribadi & non-komersial. Lihat [LICENSE.md](LICENSE.md) untuk ketentuan lengkap.

---

<div align="center">
Dibuat dengan 💙 — Noisy Deploy
</div>
