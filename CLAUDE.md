# JT Fan Site

Justin Timberlake hayran sitesi — albüm/single satışları, sertifikasyonlar, canlı stream verileri ve kariyer istatistikleri için statik bir site. Vercel'de host ediliyor; GitHub Actions ile günlük snapshot alınıyor.

## Stack

- **Frontend:** Vanilla HTML/CSS/JS (framework yok). TailwindCSS CDN üzerinden.
- **Hosting:** Vercel (statik + 1 serverless function: `api/spotify.js`).
- **Veri kaynakları:**
  - `data.json` — albüm-seviye veriler (pure sales, YouTube view'ları, video ID'leri).
  - `data/vault.json` — şarkı/albüm sertifikasyonları (ülke bazlı).
  - **Kworb proxy** (`MY_DYNAMIC_API`, `config.js`) — canlı Spotify stream sayıları (HTML tablo scrape). Yalnızca JT'nin sanatçı sayfasına sabit; parametre almaz.
  - **`api/kworb.js`** — izin listesindeki başka bir sanatçının Kworb sayfasını sunucudan çeker (kworb.net CORS vermiyor). Kullanıcıları: `four-minutes.js` ve `collab-streams.js`.
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
- **Şarkı bazlı `us_share`** dönem sabitini geçersiz kılar — aşağıya bak.

### Ölçülmüş ABD payı — `us_share`

Dönem sabitleri (0.27 / 0.35) kataloğun tamamını tarif edemiyor: **Suit & Tie** ABD merkezli (Jay-Z'li, dışarıda tutmadı), **CAN'T STOP THE FEELING!** küresel (Trolls). Tek sabit pay ikisini aynı anda anlatamaz ve ABD merkezli olanı sistematik olarak ezer.

**Çözüm düz bir çarpan DEĞİL** — o, kanıtı olmayan şarkıları da şişirirdi. Pay şarkı bazında ve **yalnızca ölçümü olan şarkıda** yazılır; geri kalan her satır dönem sabitinde kalır.

```json
"us_share": {
  "value": 0.5895,
  "basis": "luminate_week",
  "measured_at": "2026-08-20",
  "evidence": "...ölçümün tamamı, sayılarıyla...",
  "source": "https://www.billboard.com/..."
}
```

İki kanıt sınıfı (`US_SHARE_BASES`, `vault.js`):

- **`luminate_week`** — yayınlanmış **mutlak** ABD haftalık stream sayısı (Billboard/Luminate). Aynı haftanın global Spotify artışı kendi Firestore snapshot'larımızdan çıkarılıp oran doğrudan ölçülür. **Yüzde değişim yayınlayan haberler işe yaramaz**, mutlak sayı şart.
- **`riaa_floor`** — ödülün dayattığı taban. `Nx Platin` = "o tarihte en az N milyon ünite vardı"; `(ödül − pure_sales_us) × 150` o tarihte olması **zorunlu** ABD stream sayısını verir. Model bundan azını görüyorsa düşük hesapladığı kanıtlanmıştır. Bu bir **alt sınır**: ödül geçmişte verildi ve RIAA YouTube UGC'yi de sayıyor, biz saymıyoruz.

Kurallar:
- Pay her zaman kanıtın izin verdiği **en düşük** değere aşağı yuvarlanır — tabanın üstüne çıkılmaz.
- `basis` + `evidence` + `source` üçü de zorunlu; eksikse `resolveMeasuredUSShare` bloğu **yok sayar** ve konsola uyarı yazar. Gerekçesiz sayı sessizce toplamı oynatmasın diye.
- `riaa_floor` satırları bugünün ekranını değiştirmez (USA kolonu zaten `max(live, cert)`); yaptıkları şey o şarkıyı donmuş olmaktan çıkarıp bundan sonraki stream'lere kredi vermek.
- Stream verisi eksik olan bir şarkıya `riaa_floor` **yazılmaz** — "kanıt" bug'dan gelir. Önce veri düzeltilir, sonra taban yeniden hesaplanır (bkz. `collab-streams.js`).

Şu an kanıtlı satırlar: Suit & Tie (`luminate_week`), Love Never Felt So Good / Holy Grail / Selfish / Better Place / Dead And Gone (`riaa_floor`). **CSTF'e bilerek dokunulmadı** — 14× ödülü 1,530,000,000 stream dayatıyor, model zaten 1,64 milyar görüyor (çarpan 0.93), yani düşük hesapladığımız kanıtlanmıyor.

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
      },
      "certification_dates": {
        "Germany": "2017-09",
        "Italy": "2024-W49"
      }
    }
  ],
  "albums": [ /* aynı yapı */ ]
}
```

### Sertifika değerinin üç biçimi

`official_certifications` içindeki bir ülke değeri şunlardan biri olabilir:

```json
"UK": "3x Platinum",                                    // eski biçim: eşik tablosundan hesaplanır
"Germany": { "level": "1x Platinum", "units": 300000,   // resmî ünite saklanır, eşik tablosu kullanılmaz
             "metric": "sales_equivalent",
             "certified_at": "2017-09",
             "threshold_basis": "2006 çıkışı → BVMI single 2003–2014 ölçeği (Platin 300.000)" },
"Denmark": [ { ... }, { ... } ]                         // aynı ülkede birden fazla ödül
```

- **`units` doluysa `CERT_MAPPINGS` hiç kullanılmaz.** Sebebi: eşikler ülkeye değil, **ülke × format × dönem**'e bağlı. Almanya'da eşik eserin **çıkış tarihine** göre belirlenir — BVMI: *"Die Auszeichnungsschwellen richten sich nach dem Veröffentlichungsdatum des Tonträgers, nicht nach dem Zertifizierungsdatum."* Tek düz tabloyla doğru sonuç alınamaz.
- **`metric`** satış tipi değilse (`streams`, `revenue_local_currency`) ödül **ünite toplamına girmez**; saklanır ve rozette görünür ama satış ünitesi gibi toplanmaz. Satış tipleri: `sales_equivalent`, `paid_downloads`, `physical_units`, `raw_units`.
- **`threshold_basis`** hangi dönem eşiğinin neden seçildiğini yazar. Sonradan denetlenebilmesi için zorunlu sayılmalı.

İlgili fonksiyonlar `vault.js`'te: `resolveCert` (üç biçimi normalize eder), `certUnits` (yalnızca satış metriklerini toplar), `nonSalesAwards`, `certLabel` (rozet metni).

**Alman single eşikleri, çıkış tarihine göre:** 2003-01-01–2014-05-31 → Gold 150.000 / Platin 300.000 · 2014-06-01–2023-06-29 → 200.000 / 400.000 / Diamond 1.000.000 · 2023-06-30 sonrası → 300.000 / 600.000. Albüm: 1999-09-25–2002-12-31 → 150.000 / 300.000 · 2003-01-01–2023-06-29 → 100.000 / 200.000.

- **`certification_dates`** (opsiyonel): `official_certifications` ile aynı ülke anahtarlarını kullanır, ödül tarihini tutar. Formatlar: `2017-09`, `2024-W49` (FIMI hafta numarası), `2003-06-10`, `2013`. **Hesaba girmez** — motor tarihi okumuyor. Amacı her satırı denetlenebilir kılmak: eşiğin o tarihte geçerli olup olmadığı ancak tarih yazılıysa kontrol edilebilir. Eksik olması sorun değil; tarihi bilinmeyen satırlarda anahtar hiç yazılmaz.
- **`Others`** anahtarı: belirli bir ülkeye atanmamış birikmiş üniteler için (örn. South Korea, Japan parçaları). `parseCertString` bunu da işler.
- **Eşik tablosu olmayan pazarlar** (`CERT_MAPPINGS`'te yoksa — Argentina, Finland, Hungary, Russia, South Africa, Ireland, Norway, `Other`, `Others`) için **mutlaka ham ünite** yaz: `"Russia": "200000 units"`. İsimli seviye (`"Diamond"`) bu pazarlarda 0 sayılır. `validate-certs.js --vault` bunu yakalar.
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
- **Üç şarkının Kworb'da JT sayfasında hiç satırı yok** — `Where Is The Love?` (Black Eyed Peas), `Give It To Me` (Timbaland), `Rehab` (Rihanna). Vault bunları sıfır Spotify ile hesaplıyordu, yani on yıllık dinlenme yok sayılıyordu; üçü de RIAA ödülünün dayattığı tabanın altına düşüyordu. `collab-streams.js` bunları `api/kworb.js` üzerinden çekiyor. Sayılan satırlar `counted`, atlananlar gerekçesiyle `skipped` içinde tek tek yazılı; **tanınmayan bir sürüm çıkarsa sayılmaz, konsola uyarı düşer**. Dedupe JT'nin canlı listesiyle farktan yapılıyor (`collabKey`, `normalizeKworbTitle` değil) — Kworb satırı JT'ye eklerse kendiliğinden devre dışı kalır.
  - **Kapsam yalnızca vault.** `streams.html` kariyer toplamı JT'nin *kredili* Spotify kataloğunu sayıyor; Where Is The Love? kredide BEP'in. `liveStreams.albums`'a da eklenmiyor: Orphan'ın albüm toplamı büyürse kendi YT ID'si olmayan tek şarkı olan `Hair Up` sessizce küçülürdü.
  - **Timbaland'ın Kworb sayfasında `daily` kolonu bozuk** (Promiscuous'a 9.9M/gün yazıyor). Yedek büyüme oranı oradan alınmaz; `Give It To Me` yedeği `daily: 0` ile sabit tutuluyor.
- **"4 Minutes" altı sürüm, JT'nin Kworb sayfasında ikisi var.** Diğer dördü (112M'lik ikinci yayın + Live/Peter Saves/Junkie XL) yalnızca Madonna'nın sayfasında. `four-minutes.js` bunları `api/kworb.js` üzerinden çekip ekliyor; vault, streams ve album aynı fonksiyonu çağırıyor. Hangi satırın eksik olduğu başlık yazımından (`&` / `and`) **değil**, JT'nin canlı listesiyle farktan belirleniyor — Kworb bir sürümü JT sayfasına eklerse kendiliğinden elenir. `normalizeKworbTitle` `&`→`and` çevirdiği için bu dedupe'ta **kullanılamaz**; `fourMinKey` kullanılır.
