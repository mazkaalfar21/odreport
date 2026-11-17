# Organization Development Report

Aplikasi pelaporan Divisi Organization Development: Daily, Weekly, Monthly, Approval Dokumen, Analytics, dan impor dari Excel.
Versi 4: data terbaru selalu di atas, aktivitas Daily terhubung ke dokumen, status approval dan jenis dokumen bisa diatur, login wajib dengan username + PIN per pengguna, report dipisah per user.
Situs statis (HTML + CSS + JavaScript), **tanpa build**, siap deploy di **Vercel** lewat **GitHub**.

## Struktur proyek

```
od-report/
├── index.html          # kerangka halaman
├── assets/
│   ├── style.css       # tampilan (mode gelap/terang)
│   └── app.js          # seluruh logika aplikasi
├── apps-script.gs      # penerima di Google Sheets (dipasang di spreadsheet, bukan di Vercel)
├── favicon.svg
├── vercel.json         # konfigurasi Vercel + header keamanan
├── package.json        # hanya untuk menjalankan lokal (npm run dev)
└── .gitignore
```

## 1. Coba di komputer sendiri (opsional)

Klik dua kali `index.html`, atau jalankan server lokal:

```
npx serve . -l 3000
```
lalu buka http://localhost:3000

## 2. Upload ke GitHub

### Cara A: lewat website (tanpa instal apa pun)
1. Buka https://github.com dan daftar/login.
2. Klik **+** (kanan atas) → **New repository**.
3. Repository name: `od-report`. Pilih **Private**. Jangan centang "Add a README". Klik **Create repository**.
4. Di halaman repo yang kosong, klik tautan **uploading an existing file**.
5. Ekstrak zip proyek, lalu **seret isinya** (`index.html`, `favicon.svg`, `vercel.json`, `package.json`, `README.md`, `.gitignore`, dan folder `assets`) ke kotak upload. Pastikan folder `assets` ikut terunggah beserta `style.css` dan `app.js`.
6. Klik **Commit changes**.

### Cara B: lewat Git (terminal)
```
cd od-report
git init
git add .
git commit -m "Versi awal"
git branch -M main
git remote add origin https://github.com/USERNAME/od-report.git
git push -u origin main
```
(ganti `USERNAME` dengan username GitHub Anda)

## 3. Deploy di Vercel

1. Buka https://vercel.com → **Sign Up** → **Continue with GitHub** (izinkan akses).
2. Klik **Add New… → Project**.
3. Cari repo `od-report` → **Import**. (Jika tidak muncul, klik *Adjust GitHub App Permissions* dan beri akses ke repo tersebut.)
4. Pada halaman konfigurasi:
   - **Framework Preset**: `Other`
   - **Build Command**: kosongkan
   - **Output Directory**: kosongkan
   - **Install Command**: kosongkan
   - **Root Directory**: `./`
5. Klik **Deploy**. Tunggu sekitar 30 detik, lalu klik **Visit** untuk membuka situs (alamat `nama-proyek.vercel.app`).

## 4. Mengubah nama alamat / domain sendiri
- Vercel → proyek → **Settings → Domains** → tambahkan domain, ikuti petunjuk DNS yang ditampilkan.

## 5. Cara memperbarui aplikasi
Setiap perubahan yang di-*commit* ke branch `main` akan otomatis dideploy ulang oleh Vercel.
- Lewat web: buka file di GitHub → ikon pensil (Edit) → ubah → **Commit changes**.
- Lewat Git: `git add . && git commit -m "pesan" && git push`.

## 6. Pertama kali dipakai
Aplikasi dimulai dengan **halaman login** (username + PIN). Akun bawaan: `sekar` = Sekar Ayuning Srikandi (OD Leader), `rizal` = Rizal Hamdi (OD Staff), `visitor` = Visitor (Viewer). **PIN awal semua akun: 1234** — segera ubah lewat **User Management → Edit** (hanya OD Leader). Username bisa diubah dan pengguna baru bisa ditambah lewat User Management. Setelah masuk, masukkan data lama lewat **Pengaturan → Impor file Excel / Salin-tempel**, atau langsung isi Daily Report.
Data versi lama otomatis dimigrasi (status lama menjadi On Progress / Release).

## Cara kerja data (penting)

| Hal | Kondisi saat ini |
|---|---|
| Penyimpanan | `localStorage` di browser masing-masing perangkat |
| Berbagi antar pengguna | **Belum** di website. Data satu orang tidak terlihat orang lain, tetapi pekerjaan Daily Report semua user terkumpul di Google Sheets (lihat bagian Sinkron) |
| Login | **Wajib** username + PIN saat membuka aplikasi. Username bawaan `sekar` / `rizal` / `visitor`, PIN awal `1234`, ubah di User Management. OD Staff hanya melihat report miliknya; OD Leader & Viewer melihat semua. Bukan pengamanan penuh (data tetap di localStorage) |
| Backup | Pengaturan → Backup data (.json) dan Pulihkan |
| Ekspor | Excel (.csv, dibuka di Excel), Word (.doc), PDF (lewat dialog cetak → Simpan sebagai PDF) |

Jika data dipakai bersama oleh seluruh tim (Leader melihat laporan Staff secara langsung), dibutuhkan **database + login sungguhan** (misalnya Supabase atau Vercel Postgres). Itu tahap berikutnya dan struktur kode ini sudah disiapkan untuk itu.

## Sinkron Daily Report ke Google Sheets

Pekerjaan yang sudah **Simpan Laporan** di Daily Report otomatis masuk ke spreadsheet Weekly Report:
tab bulan (`Nov'26`, `Des'26`, …) → blok **POSISI** → blok **WEEK**, kolom DETAIL PEKERJAAN / STATUS / KENDALA / SOLUSI / KETERANGAN.
Berlaku untuk setiap user dari perangkatnya masing-masing. Status: Done → Closed, On Progress → On Progress, Hold → Open.
Edit memperbarui baris yang sama dan hapus ikut menghapus barisnya (dikenali lewat kolom H "SYNC ID" yang disembunyikan).
Baris yang diketik manual di sheet tidak pernah diubah. Data contoh dan hasil impor Excel tidak dikirim.
Minggu mengikuti aturan template: Sabtu–Jumat, masuk ke bulan hari Rabu-nya.

Pemasangan (sekali, oleh pemilik spreadsheet):
1. Buka spreadsheet Weekly Report → **Ekstensi → Apps Script**.
2. Hapus isi `Code.gs`, tempel seluruh isi `apps-script.gs`, lalu Simpan.
3. **Deploy → Deployment baru → Aplikasi web**: Jalankan sebagai **Saya**, Akses **Siapa saja** → Deploy → izinkan akses → salin URL berakhiran `/exec`.
4. Di `assets/app.js`, isi `SYNC_DEFAULT` (`url` = URL /exec, `wl` = link spreadsheet), commit & push.
   Semua user langsung tersambung tanpa setting. (Alternatif: isi lewat **Pengaturan → Sinkron ke Google Sheets** di akun OD Leader, hanya berlaku di perangkat itu.)
5. Di akun OD Leader klik **Tes Koneksi**. Status sinkron setiap user terlihat di menu Pengaturan masing-masing.

Setiap kali `apps-script.gs` diubah: **Deploy → Kelola deployment → pensil → Versi: Versi baru → Deploy** (URL tetap sama).
Catatan: tidak memakai kode rahasia. Siapa pun yang tahu URL /exec (terlihat di kode situs dan repo) bisa mengirim baris ke spreadsheet.

## Catatan
- Zona waktu tanggal: **Asia/Jakarta**. Minggu dihitung **Sabtu–Jumat**; "Week N" mengikuti bulan tanggal Sabtu awal minggu.
- File CSV memakai pemisah `;` dan baris `sep=;` agar langsung rapi di Excel (termasuk Excel berbahasa Indonesia).
- Paket Vercel **Hobby** diperuntukkan penggunaan pribadi/non-komersial. Untuk pemakaian perusahaan, periksa ketentuan Vercel dan pertimbangkan paket Pro.
