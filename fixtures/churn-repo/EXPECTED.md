# EXPECTED — churn-repo fixture

Bu fixture, `packages/engine`'deki **Git churn parser**'ın test edileceği
elle hesaplanmış (ve gerçek `git log` ile çapraz doğrulanmış) beklenen
değerleri içerir.

**Diğer iki fixture'dan (`simple-project`, `cyclic-project`) farkı**: bu bir
statik dosya klasörü değil, bir **setup script**'i —
`packages/engine/tests/helpers/create-churn-fixture-repo.ts`. Bu script her
çağrıldığında, OS'un geçici dizininde (`os.tmpdir()`), sabit bir commit
geçmişine sahip, tamamen yeni ve izole bir git repo'su kurar (`mkdtemp` ile),
ve `cleanup()` ile onu siler. **Bu repo hiçbir zaman CodeAtlas'ın kendi
`.git`'ine gömülü/committed bir `.git` klasörü olarak var olmaz** — testler
her çalıştığında sıfırdan kurulur ve yıkılır.

## Neden gerçek bir git repo (mock değil)

Churn parser'ın işi gerçek `git log --numstat` çıktısını parse etmek. Bu
çıktıyı taklit eden bir string fixture'ı, parser'ın gerçek git'in ürettiği
formatla (satır sonları, tab-ayrılmış numstat sütunları, merge/binary
edge-case'leri, git sürümleri arası format farklılıkları) gerçekten
uyumlu olduğunu hiç doğrulamaz — sadece "parser, benim tahmin ettiğim
formatı parse edebiliyor mu" sorusuna cevap verir. Gerçek bir repo'ya karşı
test etmek, gerçek git komutunu gerçekten çalıştırıp gerçek çıktısını
parse ediyor olmamızı garanti eder.

## Determinizm: sabit referans tarih, "bugün"e göre değil

Churn hesaplaması doğası gereği bir zaman penceresine bakar ("son N gün").
Eğer parser her zaman `Date.now()`'a göre pencere hesaplasaydı, bu test
çalıştırıldığı güne göre farklı sonuç verirdi (fixture'daki commit'ler
zamanla pencerenin dışına düşerdi). Bunun yerine:

- `computeChurn`'e geçilecek referans "şimdi" (`asOf`) **testte sabit bir
  değer** olarak veriliyor: `asOf = 2024-01-01T00:00:00Z`.
- Pencere: `windowDays = 90` → `since = asOf - 90 gün = 2023-10-03T00:00:00Z`
  (Python'da `datetime(2024,1,1) - timedelta(days=90)` ile hesaplanıp
  doğrulandı, elle değil).
- `computeChurn` fonksiyonu "şimdi"yi kendi içinde `new Date()` ile
  okumak yerine bir parametre olarak alacak (dependency injection of
  time) — bu sayede test, gerçek çalıştırma tarihinden tamamen bağımsız
  ve sonsuza kadar deterministik olur.

## Sınır davranışı: `--since`/`--until` HER İKİ UÇTA DA dahil (inclusive)

Bu, tahmin edilmedi — gerçek `git log` ile denenerek doğrulandı: tam
`--since` anında olan bir commit VE tam `--until` anında olan bir commit,
ikisi de sonuca dahil oluyor. Fixture bunu bilerek iki sınır-durumu
commit'i içeriyor (aşağıdaki tabloda işaretli).

## Commit geçmişi (`create-fixture-repo.ts`'teki `FIXTURE_COMMITS` ile birebir)

| # | commit date (UTC)         | dosyalar              | pencerede mi? |
|---|----------------------------|------------------------|:---:|
| 1 | 2023-09-01T12:00:00Z        | fileA.ts, fileB.ts     | ❌ (since'ten önce) |
| 2 | 2023-10-03T00:00:00Z        | fileB.ts               | ✅ (**since sınırında**) |
| 3 | 2023-10-20T09:00:00Z        | fileA.ts               | ✅ |
| 4 | 2023-11-15T14:00:00Z        | fileA.ts, fileC.ts     | ✅ (çok-dosyalı commit) |
| 5 | 2023-12-05T10:00:00Z        | fileB.ts               | ✅ |
| 6 | 2023-12-31T23:59:59Z        | fileA.ts               | ✅ |
| 7 | 2024-01-01T00:00:00Z        | fileC.ts               | ✅ (**until sınırında, =asOf**) |
| 8 | 2024-01-15T00:00:00Z        | fileC.ts               | ❌ (asOf'tan sonra, "gelecek") |

Pencere: `[2023-10-03T00:00:00Z, 2024-01-01T00:00:00Z]` — **6 commit** içeride
(#2–#7), **2 commit** dışarıda (#1 çok eski, #8 asOf'tan sonra).

Bu, gerçek `git log --no-renames --numstat --since=... --until=...` çıktısına
karşı çalıştırılıp doğrulandı (ham çıktı aşağıda):

```
@@COMMIT@@ 2024-01-01T00:00:00+00:00
1	0	fileC.ts

@@COMMIT@@ 2023-12-31T23:59:59+00:00
1	0	fileA.ts

@@COMMIT@@ 2023-12-05T10:00:00+00:00
1	0	fileB.ts

@@COMMIT@@ 2023-11-15T14:00:00+00:00
1	0	fileA.ts
1	0	fileC.ts

@@COMMIT@@ 2023-10-20T09:00:00+00:00
1	0	fileA.ts

@@COMMIT@@ 2023-10-03T00:00:00+00:00
1	0	fileB.ts
```

## Elle hesaplama: dosya başına churn_commits

Pencere içindeki 6 commit'i dosyaya göre sayıyoruz (bir commit bir dosyayı
en fazla bir kez sayar — her numstat satırı zaten distinct bir commit'i
temsil ediyor):

- **fileA.ts**: commit #3, #4, #6 → **churn_commits = 3**
- **fileB.ts**: commit #2, #5 → **churn_commits = 2**
- **fileC.ts**: commit #4, #7 → **churn_commits = 2**

| module_id  | churn_commits |
|------------|:---:|
| fileA.ts   | 3 |
| fileB.ts   | 2 |
| fileC.ts   | 2 |

**Sağlama**: pencere içindeki toplam commit sayısı 6, ama
`sum(churn_commits) = 3+2+2 = 7`. Bu bir hata değil — commit #4 iki dosyayı
birden değiştiriyor (fileA.ts VE fileC.ts), bu yüzden dosya bazlı toplam,
commit sayısını çok-dosyalı commit'ler kadar aşar. `fileA.ts` en yüksek
churn'e sahip — bu ileride hotspot fusion demosunda kullanılacak "en çok
değişen dosya" örneği olacak.

## Kapsam dışı bırakılanlar (bilinçli, test edilmedi)

- **Rename tespiti**: `--no-renames` bilerek geçildi. Git'in rename
  sezgiselliği (benzerlik eşiği) belirsiz/versiyon-bağımlı davranabilir;
  bunun yerine her rename, basit bir "eski dosya silindi + yeni dosya
  eklendi" olarak görünür. Fixture'da hiç rename yok, bu yüzden bu davranış
  şu an test edilmiyor.
- **Merge commit'ler**: Fixture'da hiç merge yok (doğrusal geçmiş). Git'in
  varsayılan `--numstat` davranışı merge commit'ler için diff göstermez;
  bu proje kapsamında ayrıca ele alınmadı.
- **Binary dosyalar**: numstat'ta `-\t-\t<path>` şeklinde görünür (satır
  sayısı yerine tire). Parser sadece dosya yolunu okuyacağı için bu zaten
  sorunsuz çalışır, ama fixture'da ayrıca test edilmedi.
