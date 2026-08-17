# JT Fan Site

Justin Timberlake hayran sitesi — albüm/single satışları, sertifikasyonlar, canlı stream verileri ve kariyer istatistikleri için statik bir site. Vercel'de host ediliyor; GitHub Actions ile günlük snapshot alınıyor.

## Stack

- **Frontend:** Vanilla HTML/CSS/JS (framework yok). TailwindCSS CDN üzerinden.
- **Hosting:** Vercel (statik + 1 serverless function: `api/spotify.js`).
- **Veri kaynakları:**
  - `data.json` — albüm-seviye veriler (pure sales, YouTube view'ları, video ID'leri).
  - `data/vault.json` — şarkı/albüm sertifikasyonları (ülke bazlı).
  - **Kworb proxy** (`MY_DYNAMIC_API`, `config.js`) — canlı Spotify stream sayıları (HTML tablo scrape).
  - **YouTube Data API v3** (`YOUTUBE_API_KEY`) — gerçek zamanlı YT görüntüleme sayısı.
  - **Spotify Web API** (`api/spotify.js` proxy üzerinden) — sanatçı bilgisi, top tracks, monthly listeners (LD+JSON scrape).
  - **Firestore** — günlük snapshot geçmişi (`scripts/daily-snapshot.js`).

## Sayfalar

| Sayfa | Amaç |
|-------|------|
| `index.html` | Ana sayfa / hero |
| `vault.html` | Sertifikasyon vault (en çok güncellenen sayfa) |
| `streams.html` | Canlı stream takibi |
| `album.html` | Tekil albüm sayfası |
| `analytics.html`, `charts.html` | Grafikler |
| `awards.html`, `tours.html`, `about.html`, `game.html`, `transform.html` | Diğer içerikler |

## Vault hesaplama motoru — `vault.js`

Sitenin kalbi burası. Her şarkı/albüm için **global ünite** hesaplıyor.

### Akış

1. `fetchVaultData()` → `data/vault.json` + `data.json` çeker.
2. `fetchLiveStreams()` → Kworb proxy'den canlı Spotify stream tablosunu parse eder.
3. `fetchRealYouTubeViews()` → YouTube Data API'den gerçek view sayılarını alır.
4. `computeAllData()` → her şarkı/albüm için:
   - **USA** = `max(rawUsLive, parseCertString(officialUSA))` → sonra `quantizeRIAAUnits` ile **alta yuvarlanır en yakın 1M'e**.
   - **MAIN_7** (USA, UK, Brazil, Germany, Australia, Canada, Mexico) ayrı kolonlarda.
   - **Other** = MAIN_7'de olmayan tüm pazarların (Italy, Poland, NZ, Denmark, France, Spain, Japan, vs.) toplamı + `World` + `Others` özel anahtarları.

### `parseCertString(certStr, country, itemType, itemId)`

`"2x Platinum"`, `"Gold"`, `"1x Diamond"`, `"Platinum + Gold"` (kombinasyon) ve `"100000 units"` / `"100k units"` (ham birim) formatlarını destekler.

**ÖNEMLİ:** Ham sayıları `"NNNN units"` olarak yaz — virgüllü stringler (`"243,545"`) parse edilemez ve **0** sayılır. Streaming sertifikasyonu (Denmark gibi) için `"1800000 units"` kullan; çünkü `CERT_MAPPINGS["Denmark"].song.Platinum = 90000` (fiziksel/dijital eşik), gerçek streaming Platinum'u 1.8M.

### `CERT_MAPPINGS`

Ülke başına `Gold/Platinum/Diamond` eşikleri. Bazı ülkelerde `album` ve `song` ayrımı var (UK, Brazil, Germany, NZ, Denmark, Spain, Sweden, Belgium, Austria, Portugal). **Canada Legacy Rule:** `Justified` ve `FutureSex/LoveSounds` için eski 50k/100k eşikleri uygulanır (`parseCertString` içinde override edilir).

### `quantizeRIAAUnits`

USA için RIAA mantığı: `< 500k → 0`, `500k–1M → 500k`, `≥1M → floor(units/1M)*1M`. Sonuç: 3.3M pure sales **3.0M**'e yuvarlanır (300K kayıp). Live stream eklenirse 4M+ eşiğine atlayabilir.

### Sabitler

- `ARTIST_RATIO = 1.82` — Spotify global/AOD multiplier (catalog hits için tune edilmiş).
- `US_SHARE = 0.35` — yeni eserler için US payı; **pre-2016 eralar (Justified, FSLS, 20/20 1+2) için `0.27`**.
- Orphan tracks: `post2016Orphans` listesi (Stay With Me, Better Place, vs.) yeni US share kullanır; geri kalanları 0.27.

## Veri yapısı — `data/vault.json`

```json
{
  "songs": [
    {
      "id": "suit_and_tie",
      "title": "Suit & Tie",
      "album_id": "The 20/20 Experience",
      "pure_sales_us": 3300000,
      "official_certifications": {
        "USA": "1x Platinum",
        "UK": "Gold",
        "Canada": "2x Platinum",
        "Denmark": "1800000 units",
        "Others": "243545 units",
        "World": "None"
      }
    }
  ],
  "albums": [ /* aynı yapı */ ]
}
```

- **`Others`** anahtarı: belirli bir ülkeye atanmamış birikmiş üniteler için (örn. South Korea, Japan parçaları). `parseCertString` bunu da işler.
- **`World`** anahtarı: global IFPI sertifikası varsa (genelde `"None"`).

## Config & secrets

- `config.js` — git'te (gitignored değil), `MY_DYNAMIC_API` (Kworb proxy URL'i) ve `YOUTUBE_API_KEY` içerir. `config.example.js` template.
- `api/spotify.js` — Spotify CLIENT_ID/SECRET hardcoded (⚠️ public repo'da rotate gerekebilir).
- GitHub Secrets (Actions için): `FIREBASE_SERVICE_ACCOUNT`, `KWORB_PROXY_URL`.

## GitHub Actions

`.github/workflows/`:
- `daily-snapshot.yml` — her gece 00:05 UTC, Kworb'dan veri çekip Firestore'a kaydeder (`scripts/daily-snapshot.js`).
- `backfill-extra-track.yml` — manuel tetiklenir, eksik track snapshot'larını doldurur.

## Yaygın görevler

### Bir şarkının sertifikasyonunu güncelleme
`data/vault.json` içinde ilgili `id`'yi bul, `official_certifications` bloğunu düzenle. Wikipedia certifications tablosu birincil kaynak.

**Değişiklikten sonra mutlaka çalıştır:**
```bash
node scripts/validate-certs.js --vault
```

### Sertifika verisi doğrulama — `scripts/validate-certs.js`

Bir sertifika ünitesi tek bir olgu değil, **iki bağımsız olgunun çarpımıdır**: (a) ödülün seviyesi/çarpanı/tarihi, (b) o seviyenin *o tarihte*, *o format ve repertuar sınıfı için* ne demek olduğu. İkisi ayrı yazılmazsa yanlış eşik kullanıldığı görünmez olur.

- `--vault` modu → `data/vault.json`'ı `vault.js`'in **gerçek** `parseCertString`'ine karşı denetler (fonksiyonu kaynaktan çeker, yeniden yazmaz). 0 ünite sayılan satırları yakalar: eşik tablosu olmayan pazarda isimli seviye, virgüllü ham sayı, tanınmayan seviye.
- `<dosya.csv>` modu → dışarıdan gelen araştırmayı vault'a girmeden denetler. Zorunlu kolonlar: `country, type, title, level, threshold_at_award, metric, counted_sales_download_units, award_source, threshold_source, status`.

Kurallar:
- `threshold_at_award` boş olamaz; ülkenin genel tablosu değil **ödül tarihindeki** eşik yazılır.
- `counted_sales_download_units` = eşik × çarpan. Gerçek satış rakamı biliniyorsa `official_reported_value`'ya yazılır, `counted`'a değil.
- `metric` `streams` veya `revenue_local_currency` ise `counted` **boş bırakılır** — Danimarka stream eşiği ve Polonya PLN gelir eşiği satış ünitesine çevrilmez.
- `award_source` ve `threshold_source` ayrı; ikisi aynıysa uyarı verir.

### Yeni ülke ekleme
1. `vault.json`'da şarkıya `"ÜlkeAdı": "Nx Platinum"` ekle.
2. `vault.js` `CERT_MAPPINGS`'te eşikler tanımlı değilse ekle.
3. Ülke `MAIN_7`'de değilse otomatik olarak `Other` kolonuna toplanır.

### Streaming sertifikasyonu (Denmark vb.)
`CERT_MAPPINGS` fiziksel eşikleri kullanır. Streaming için ham birim yaz: `"Denmark": "1800000 units"`.

### USA sayısı 6M'i geçmiyor
- `pure_sales_us` 3.3M ise quantize 3M'e indirir; live Spotify verisi gelmiyorsa USA sabit 3M kalır.
- Kworb proxy'den title eşleşmesi başarısız olabilir (`getTrackSpotify` fuzzy contains kullanıyor). Title'da özel karakter (`&`, `–`) varsa kontrol et.

## Bilinen tuhaflıklar

- `vault.json`'da `Mirrors` için `"USA": ""` (boş string) — `parseCertString` 0 döner, sorun değil.
- `Senorita` ID'si `"señorita"` (Türkçe ñ).
- `Orphan` albümü `computeAllData` içinde `albums` listesinden filtrelenir (`a.id !== "Orphan"`), ama şarkıları gösterilir.
- Linter/IDE bazen `vault.json`'da değişiklikleri revert ediyor gibi görünebilir — edit sonrası mutlaka `Read` ile doğrula.
