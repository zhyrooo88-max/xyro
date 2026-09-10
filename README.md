# XTZYYY Premium API v3

Premium REST API platform siap Termux.

### Website video
Halaman utama menampilkan video hero dari:
`https://litter.catbox.moe/j8zkrc.mp4`

Video menggunakan HTML5 `<video>` dengan autoplay muted, loop, playsinline, dan controls.

## Install

```bash
pkg update -y
pkg install nodejs-lts unzip -y
unzip xtzyyy-premium-api-termux.zip
cd xtzyyy-premium-api-termux
npm install
npm start
```

Buka:

```text
http://127.0.0.1:3000
```

Jika port 3000 sedang digunakan:

```bash
PORT=3001 npm start
```

## Automatic API Key

API key dibuat otomatis dan disimpan di:

```text
data/apikey.json
```

Lihat key:

```bash
curl http://127.0.0.1:3000/api/key
```

## Endpoints

- POST `/api/v1/capcut/create`
- POST `/api/v1/capcut/verify`
- GET `/api/v1/nftoken-gen`
- POST `/api/v1/alight-motion/send`
- POST `/api/v1/alight-motion/verif`
- POST `/api/v1/xtzyyy/test` (proxy test ke external API)
- GET `/api/v1/xtzyyy/test` (GET test ke external API)

Semua endpoint terlindungi API key.

Header:

```text
x-api-key: API_KEY_KAMU
```

Website sudah menyediakan tombol **Send Request** untuk setiap endpoint, parameter form, Request URL, dan Response JSON.

## Upstream

Project ini memisahkan **URL upstream** dari endpoint lokal. Endpoint CapCut/Alight Motion hanya akan diteruskan jika URL provider yang sah sudah Anda konfigurasi.

```env
CAPCUT_CREATE_URL=
CAPCUT_VERIFY_URL=
ALIGHT_SEND_URL=
ALIGHT_VERIFY_URL=
```

Untuk generic external API, konfigurasi bawaan project adalah:

```env
EXTERNAL_API_URL=https://api.xtzyyy.my.id/api/
EXTERNAL_API_KEY=
EXTERNAL_API_TIMEOUT_MS=15000
```

`EXTERNAL_API_KEY` sengaja kosong. Isi hanya dengan key milik/provider yang memang Anda berwenang gunakan. Jika upstream tidak memerlukan key, biarkan kosong.

Jika kosong, endpoint proxy mengembalikan HTTP 501 dengan pesan upstream belum dikonfigurasi. Ini bukan error server; isi URL upstream yang valid agar request diteruskan ke provider.

Catatan: endpoint `/api/v1/alight-motion/verif` menerima `email` sebagai parameter wajib. `link` bersifat opsional sehingga pengujian dengan email saja tidak lagi gagal karena parameter kurang.

## Test

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/api/key
```

NFToken:

```bash
curl "http://127.0.0.1:3000/api/v1/nftoken-gen?apikey=API_KEY_KAMU"
```


## Custom Multipart POST

Website juga menyediakan endpoint **Custom API**:

```text
POST /api/custom-post
```

Default target:

```text
https://api.xtzyyy.my.id/api/
```

Website menyediakan input target dan dua pasangan `field name/value`.
Header `x-apikey` otomatis memakai API key lokal.

Contoh cURL ekuivalen:

```bash
curl -X POST "https://api.xtzyyy.my.id/api/" \
  -F "field1=value1" \
  -F "field2=value2" \
  -H "x-apikey: API_KEY_KAMU"
```

> Jangan memasukkan API key atau token rahasia ke source code, screenshot, atau chat publik.


## External API Test

Default external URL:

```text
https://api.xtzyyy.my.id/api
```

Website menyediakan:
- Test Request POST
- Test Request GET
- x-apikey field
- dynamic multipart/form-data fields
- Request URL
- Response JSON

Atur URL melalui:

```env
EXTERNAL_API_URL=https://api.xtzyyy.my.id/api
```

Catatan: endpoint external menentukan sendiri nama field dan validasi API key. Jika external API mengharuskan field tertentu, masukkan nama/value field tersebut pada form-data.


## Request Buttons

Setiap endpoint pada dashboard memiliki:
- Send Request POST/GET sesuai endpoint
- Send Request GET untuk pengujian GET
- Request URL otomatis
- Response JSON
- Copy Request

`EXTERNAL_API_URL` harus berupa URL lengkap, misalnya `https://domain-anda.tld/api/`. Jangan gunakan `https:///api/` karena hostname tidak ada.


### Termux
```bash
cd ~/downloads/xtzyyy-api-fixed/xtzyyy-premium-api-termux
npm install
node --check server.js
npm start
```

If port 3000 is busy:
```bash
PORT=3001 npm start
```

`EXTERNAL_API_URL` is intentionally empty by default. Fill it with a real full URL only when you have an external upstream, for example `https://domain.tld/api/`.

## Upstream status

Setelah server hidup, cek konfigurasi upstream:

```bash
curl -H "x-api-key: API_KEY_KAMU" http://127.0.0.1:3000/api/v1/upstream/status
```

Endpoint ini tidak menampilkan nilai API key rahasia.

## Catatan penting

`EXTERNAL_API_URL` hanya menentukan **alamat upstream**. Server tidak dapat menebak nama endpoint, parameter, metode HTTP, atau format autentikasi provider yang tidak terdokumentasi. Untuk membuat endpoint CapCut/Alight Motion benar-benar bekerja, masukkan URL endpoint provider yang sah pada variabel masing-masing. Jangan memakai URL palsu/dummy.


## Alight Motion Premium endpoints

The platform now exposes:
- `POST /api/v1/alight-motion/send` with `{ "email": "..." }`
- `POST /api/v1/alight-motion/verif` with `{ "email": "...", "link": "..." }`

Both forward an authorized request to `ALIGHT_PREM_URL` using the upstream contract `{ action, email, link? }`. The included value is `https://dapjimotionpro.my.id/api/proxy-amprem`; use it only if you have permission to use that service.


## Website navigation (2026)

Website sekarang menyediakan navigasi: Home, Features, Buy Plan API, Dashboard, serta Resources (Document API, Status) dan Legal (Privacy Policy, Terms of Service, Feedback). Branding footer menggunakan label `Heyyarya` dan tahun berjalan.

Video hero: https://litter.catbox.moe/j8zkrc.mp4


## Website pages
- `/` Home
- `/features.html` Features
- `/plans.html` Buy Plan API
- `/dashboard.html` Dashboard
- `/docs.html` Document API
- `/status.html` Global Status
- `/privacy.html` Privacy Policy
- `/terms.html` Terms of Service
- `/feedback.html` Feedback

Theme tersedia: Dark, White, dan Night dengan animasi bintang jatuh.
