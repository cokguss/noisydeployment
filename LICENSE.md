# DOKUMEN INTEGRASI KHUSUS: LISENSI PERANGKAT LUNAK & KETENTUAN LAYANAN NOISY DEPLOY

**Masa Berlaku Terintegrasi: Sejak 20 Agustus 2026 hingga Saat Ini (Diperbarui secara Berkala)**

Selamat datang di **Noisy Deploy**. Dokumen ini merupakan kesatuan hukum yang mengikat secara sah antara Anda (selaku "Pengguna" atau "Penerima Lisensi") dengan **cokguss** (selaku "Pencipta", "Pemilik Hak Cipta", dan "Pengembang Utama").

Dengan mengakses, menjalankan, men-deploy, atau menggunakan perangkat lunak Noisy Deploy (termasuk seluruh komponen frontend HTML/CSS/JavaScript, integrasi GitHub REST API, lapisan data Supabase, Edge Functions, panel admin, dan aset digital pendukungnya), Anda menyatakan secara sadar bahwa Anda telah membaca, memahami, dan menyetujui seluruh isi dari Lisensi dan Ketentuan Layanan ini.

Jika Anda tidak menyetujui salah satu atau seluruh poin dalam dokumen ini, Anda tidak diperkenankan untuk menggunakan Noisy Deploy, dan diwajibkan untuk menghapus seluruh salinan kode sumber dari penyimpanan Anda.

---

## BAGIAN I: LISENSI PENGGUNAAN PERANGKAT LUNAK (SOFTWARE LICENSE)

### Pasal 1: Kepemilikan Hak Cipta & Hak Kekayaan Intelektual
1. Seluruh kode sumber, arsitektur sistem, integrasi GitHub dan Supabase, dokumentasi, dan desain visual dari Noisy Deploy adalah milik eksklusif **cokguss**.
2. Perlindungan hak cipta atas Noisy Deploy terhitung secara resmi sejak pengembangan awal pada tanggal **20 Agustus 2026** dan tetap dilindungi undang-undang yang berlaku hingga saat ini.
3. Hak kepemilikan ini tidak dialihkan kepada Pengguna dalam bentuk apa pun. Pengguna hanya mendapatkan hak pakai terbatas yang tunduk pada ketentuan dokumen ini.

### Pasal 2: Hibah Lisensi Terbatas (Grant of License)
1. cokguss memberikan lisensi non-eksklusif, tidak dapat dipindahtangankan, dapat ditarik kembali, dan terbatas kepada Pengguna untuk menjalankan Noisy Deploy pada lingkungan milik Pengguna sendiri (lokal maupun hosting pribadi).
2. Lisensi ini diberikan khusus untuk penggunaan pribadi dan non-komersial. Penggunaan komersial memerlukan kesepakatan tertulis khusus dengan cokguss.

### Pasal 3: Batasan dan Larangan Penggunaan (Restrictions)
Sebagai penerima lisensi, Anda **dilarang keras** untuk:
1. Mendistribusikan ulang kode sumber Noisy Deploy kepada pihak ketiga dengan mengklaim sebagai karya sendiri tanpa izin tertulis dari cokguss.
2. Menghapus, menyamarkan, atau memodifikasi atribusi pembuat yang tertanam di dalam kode maupun antarmuka Noisy Deploy.
3. Menggunakan bagian dari kode Noisy Deploy untuk proyek turunan berkomersial tanpa persetujuan tertulis.
4. Menyalahgunakan integrasi GitHub API maupun Supabase untuk permintaan otomatis massal, spam, penyalahgunaan kuota, atau beban berlebihan ke layanan pihak ketiga.

---

## BAGIAN II: KETENTUAN LAYANAN & PENGGUNAAN (TERMS OF SERVICE)

### Pasal 4: Kepatuhan Terhadap Layanan Pihak Ketiga
1. Noisy Deploy beroperasi dengan berinteraksi pada layanan dan Application Programming Interface (API) pihak ketiga (GitHub REST API, GitHub Pages, serta Supabase).
2. Pengguna memahami sepenuhnya bahwa setiap penyedia memiliki Ketentuan Layanan masing-masing, termasuk aturan atas konten yang di-deploy dan data yang diproses melalui layanan tersebut.
3. Segala akibat dari penggunaan Noisy Deploy — termasuk namun tidak terbatas pada pembatasan atau penangguhan akun oleh GitHub, klaim hak cipta atas konten yang di-deploy, atau pelanggaran ketentuan penyedia — adalah **tanggung jawab penuh Pengguna**. cokguss tidak bertanggung jawab atas kerugian tersebut.
4. Pengguna wajib menghormati hak cipta dan hanya men-deploy konten yang dimiliki atau diizinkan pemiliknya. Perlu diingat bahwa deploy menghasilkan repositori **publik** di akun GitHub Pengguna.

### Pasal 5: Ketersediaan Layanan & Keamanan Token
1. Noisy Deploy disediakan secara **gratis**, dengan skema Premium opsional untuk menghilangkan batas kuota deploy.
2. Noisy Deploy bergantung pada API dan kuota gratis pihak ketiga (GitHub, Supabase) yang dapat berubah, membatasi, atau berhenti sewaktu-waktu di luar kendali cokguss. Kegagalan fungsi deploy akibat perubahan pihak ketiga bukan merupakan cacat produk maupun kewajiban ganti rugi.
3. Token akses GitHub Pengguna hanya disimpan secara lokal di peramban (localStorage) dan hanya dikirim ke `api.github.com`. Token tersebut tidak pernah dikirim atau disimpan di server mana pun milik cokguss.

### Pasal 6: Privasi Data
1. Noisy Deploy tidak memaksa registrasi akun terpisah; identitas berasal dari login GitHub Pengguna.
2. Preferensi seperti bahasa dan token disimpan secara lokal di peramban Pengguna (localStorage).
3. Alamat IP yang digunakan untuk penegakan kuota disimpan dalam bentuk ter-hash (salted SHA-256), tidak pernah dalam bentuk mentah.
4. Pembayaran Premium bersifat manual tanpa gateway otomatis; bukti transfer diunggah oleh Pengguna dan diverifikasi secara manual oleh manusia.

---

## BAGIAN III: BATASAN TANGGUNG JAWAB & GARANSI (DISCLAIMER)

### Pasal 7: Pernyataan "As Is" (Apa Adanya)
PERANGKAT LUNAK INI DISEDIAKAN OLEH PEMEGANG HAK CIPTA DAN KONTRIBUTOR "SEBAGAIMANA ADANYA" (AS IS) DAN "SEBAGAIMANA TERSEDIA" (AS AVAILABLE). SEGALA JAMINAN YANG TERSIRAT ATAU TERSURAT, TERMASUK NAMUN TIDAK TERBATAS PADA JAMINAN KELAYAKAN JUAL DAN KESESUAIAN UNTUK TUJUAN TERTENTU, DITOLAK SEPENUHNYA. NOISY DEPLOY TIDAK BERAFILIASI DENGAN GITHUB MAUPUN SUPABASE.

### Pasal 8: Batasan Tanggung Jawab Kerusakan
DALAM KEADAAN APA PUN, COKGUSS TIDAK BERTANGGUNG JAWAB ATAS SEGALA KERUSAKAN LANGSUNG, TIDAK LANGSUNG, INSIDENTAL, KHUSUS, ATAU KONSEKUENSIAL YANG TIMBUL DARI PENGGUNAAN ATAU KETIDAKMAMPUAN UNTUK MENGGUNAKAN PERANGKAT LUNAK INI, TERMASUK NAMUN TIDAK TERBATAS PADA:
1. Kehilangan data penting, penghapusan repositori, atau kegagalan sistem hosting Pengguna.
2. Penangguhan atau pemblokiran akun GitHub akibat konten atau pola penggunaan Pengguna.
3. Kerugian finansial akibat gangguan layanan atau tidak berfungsinya fungsi deploy.
4. Kebocoran data atau token yang disebabkan oleh kelalaian keamanan pada sisi Pengguna atau penyedia hosting pihak ketiga.

---

## BAGIAN IV: AMENDEMEN & HUKUM YANG BERLAKU

### Pasal 9: Perubahan Dokumen
cokguss berhak untuk memperbarui, mengubah, atau mengganti bagian mana pun dari Lisensi dan Ketentuan Layanan ini sewaktu-waktu. Perubahan akan diumumkan melalui repositori resmi Noisy Deploy. Penggunaan berkelanjutan setelah perubahan tersebut dipublikasikan merupakan bentuk persetujuan eksplisit terhadap versi terbaru.

### Pasal 10: Hukum Terintegrasi
Dokumen ini diatur dan ditafsirkan berdasarkan asas keadilan serta hukum perlindungan hak cipta digital yang berlaku di Republik Indonesia. Segala perselisihan yang timbul akan diselesaikan secara kekeluargaan melalui diskusi langsung bersama cokguss selaku pencipta platform.

---

**DITETAPKAN DI: JAKARTA, INDONESIA**
**BERLAKU SEJAK: 20 AGUSTUS 2026**
**VERSI TERAKHIR: 2026 (BERLAKU HINGGA SAAT INI)**
**PENGEMBANG UTAMA: cokguss**
*Kontak Resmi: Instagram `fagubitch.exe` · Telegram `noisy05`*
