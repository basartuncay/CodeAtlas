# EXPECTED — golden-repo fixture (Adım 4 golden-file testi)

Bu fixture, `analyzeRepository` orkestratörünün ürettiği **tam JSON çıktısını**
uçtan uca doğrulayan golden-file testi için var. Diğer fixture'lardan farkı:
tüm alt sistemleri (graph, coupling, cycle, blast radius, complexity, LOC,
churn, hotspot, risks) TEK bir gerçek proje üzerinden, hepsi bir arada
test ediyor.

## Bulunan ve düzeltilen gerçek bir bug

Bu fixture'ı hazırlarken `buildDependencyGraph`'ta **önceden hiç yakalanmamış
bir bug** ortaya çıktı: `os.tmpdir()` (macOS'ta `/var` → `/private/var`
symlink'i içerir) altında `mkdtemp` ile oluşturulan bir dizine karşı
çalıştırıldığında, döngüsel import'larda aynı dosya hem doğru hem "çöp"
(symlink çözülmemiş göreli yol hesaplamasından kaynaklanan, `../../...`
ile başlayan mutlak yol) olmak üzere İKİ AYRI modül gibi görünüyordu. Kök
neden: `dependency-cruiser`, döngüsel import hedeflerini `realpath` ile
çözerken, ilk dosya taramasını verilen (realpath'siz) `baseDir`'e göre
yapıyor — ikisi sembolik link sınırında anlaşmazlığa düşüyor.

**Düzeltme**: `buildDependencyGraph`, `projectRoot`'u kullanmadan önce
`fs.realpathSync()` ile kanonikleştiriyor
(`packages/engine/src/graph/build-dependency-graph.ts`). Regresyon testi:
`packages/engine/tests/graph/build-dependency-graph.test.ts`'teki
"regression: project root under a symlinked temp dir" bloğu. Bu, önceki
hiçbir fixture'ın (hepsi ana repo'nun kendi, symlink'siz yolu altında)
yakalayamadığı bir hataydı — sadece bu golden fixture gerçek bir git
geçmişi için `mkdtemp` kullanmaya başlayınca ortaya çıktı.

## Proje yapısı

```
src/config.ts       — leaf, sabit export, HİÇ fonksiyon yok (complexity=0)
src/logger.ts       — leaf, 1 if (complexity=2)
src/store.ts        — config.ts VE cache.ts'i import eder, 1 if (complexity=2)
src/cache.ts        — store.ts'i import eder (DÖNGÜ: cache↔store), 2 fonksiyon (complexity=2)
src/main.ts         — cache.ts VE logger.ts'i import eder (complexity=1)
src/standalone.ts   — HİÇBİR ŞEYE bağlı değil, hiç import edilmiyor (complexity=1, instability=NaN)
```

Kaynak dosyaların TAM içeriği: `fixtures/golden-repo/src/*.ts` (statik,
incelenebilir — commit'lenmiş dosyalar, gerçek git geçmişi burada YOK).

## Git geçmişi (setup script: `packages/engine/tests/helpers/create-golden-fixture-repo.ts`)

Her çağrıda `mkdtemp` ile taze bir temp git repo kurulur (asla ana repo'ya
gömülmez), `create-golden-fixture-repo.ts`'teki içerik bu statik
dosyalardan okunur. "Touch" commit'leri dosyanın SON satırını yerinde
değiştirir (`content.replace(/\n$/, ' // marker\n')`) — yeni satır EKLEMEZ,
böylece kaç kez dokunulursa dokunulsun LOC değişmez.

| # | tarih (UTC) | dosyalar | pencerede mi? (since=2023-10-03, until=2024-01-01, ikisi de dahil) |
|---|---|---|:---:|
| 1 (init) | 2023-09-01T12:00:00Z | tüm 6 dosya, tam içerik | ❌ (çok eski) |
| 2 | 2023-10-15T09:00:00Z | main.ts | ✅ |
| 3 | 2023-11-10T09:00:00Z | cache.ts, store.ts | ✅ |
| 4 | 2023-12-05T09:00:00Z | cache.ts (tekrar) | ✅ |
| 5 | 2023-12-20T09:00:00Z | config.ts | ✅ |
| 6 | 2024-01-15T00:00:00Z | logger.ts | ❌ (asOf'tan sonra, "gelecek") |
| — | (hiç) | standalone.ts | asla dokunulmuyor |

`asOf=2024-01-01T00:00:00Z`, `windowDays=90` (churn-repo fixture'ıyla aynı
sınırlar). Bu, `analyzeRepository`'ye enjekte edilen sabit bir değer —
gerçek `new Date()` değil (bkz. aşağıdaki "test edilmeyen varsayılan" notu).

## Gerçek koda karşı çapraz doğrulama (implementasyon kodundan ÖNCE)

Aşağıdaki HER değer, zaten yazılmış/test edilmiş gerçek fonksiyonlar
(`buildDependencyGraph`, `computeCouplingMetrics`, `detectCycles`,
`cycleMembership`, `computeBlastRadius`, `computeComplexity`, `computeChurn`,
`computeHotspotScore`, ham `ts-morph` ile LOC) bu fixture'a karşı
çalıştırılarak elde edildi — `computeLoc`, `computeRisks`, `analyzeRepository`
henüz yazılmadığı için sadece onların girdileri/beklenen çıktıları
tahminimle (ve elle) doğrulanıyor.

**Ham çıktı** (yuvarlanmamış):
```
MODULES ["src/cache.ts","src/config.ts","src/logger.ts","src/main.ts","src/standalone.ts","src/store.ts"]
EDGES [cache→store, main→cache, main→logger, store→cache, store→config]
CYCLES [["src/cache.ts","src/store.ts"]]
CHURN [{cache:2},{config:1},{main:1},{store:1}]  (logger, standalone: hiç kayıt yok)
```

Tüm 6 modül için ham (yuvarlanmamış) değerler bire bir elle hesaplanan
tabloyla eşleşti (`instability`: cache=0.3333333333333333,
store=0.6666666666666666, standalone=`null` [ham sonuçta gerçek `NaN`];
`hotspot_score`: main=0.08000000000000002 [float artığı, bu yüzden 4
ondalığa yuvarlama kararı alındı], diğerleri tam sayılara denk geliyor).

## Final JSON (`analyzeRepository`'den beklenen — 4 ondalığa yuvarlanmış)

```json
{
  "schema_version": "1.0",
  "modules": [
    {
      "id": "src/cache.ts",
      "loc": 13,
      "cyclomatic_complexity": 2,
      "fan_in": 2,
      "fan_out": 1,
      "instability": 0.3333,
      "churn_commits_90d": 2,
      "hotspot_score": 0.6,
      "blast_radius": 2,
      "in_cycle": true
    },
    {
      "id": "src/config.ts",
      "loc": 2,
      "cyclomatic_complexity": 0,
      "fan_in": 1,
      "fan_out": 0,
      "instability": 0.0,
      "churn_commits_90d": 1,
      "hotspot_score": 0.0,
      "blast_radius": 3,
      "in_cycle": false
    },
    {
      "id": "src/logger.ts",
      "loc": 8,
      "cyclomatic_complexity": 2,
      "fan_in": 1,
      "fan_out": 0,
      "instability": 0.0,
      "churn_commits_90d": 0,
      "hotspot_score": 0.0,
      "blast_radius": 1,
      "in_cycle": false
    },
    {
      "id": "src/main.ts",
      "loc": 8,
      "cyclomatic_complexity": 1,
      "fan_in": 0,
      "fan_out": 2,
      "instability": 1.0,
      "churn_commits_90d": 1,
      "hotspot_score": 0.08,
      "blast_radius": 0,
      "in_cycle": false
    },
    {
      "id": "src/standalone.ts",
      "loc": 2,
      "cyclomatic_complexity": 1,
      "fan_in": 0,
      "fan_out": 0,
      "instability": null,
      "churn_commits_90d": 0,
      "hotspot_score": 0.0,
      "blast_radius": 0,
      "in_cycle": false
    },
    {
      "id": "src/store.ts",
      "loc": 11,
      "cyclomatic_complexity": 2,
      "fan_in": 1,
      "fan_out": 2,
      "instability": 0.6667,
      "churn_commits_90d": 1,
      "hotspot_score": 0.24,
      "blast_radius": 2,
      "in_cycle": true
    }
  ],
  "edges": [
    { "from": "src/cache.ts", "to": "src/store.ts" },
    { "from": "src/main.ts", "to": "src/cache.ts" },
    { "from": "src/main.ts", "to": "src/logger.ts" },
    { "from": "src/store.ts", "to": "src/cache.ts" },
    { "from": "src/store.ts", "to": "src/config.ts" }
  ],
  "cycles": [["src/cache.ts", "src/store.ts"]],
  "risks": [
    {
      "module_id": "src/cache.ts",
      "rule": "circular_dependency",
      "evidence": { "in_cycle": true, "cycle": ["src/cache.ts", "src/store.ts"] },
      "severity": "medium"
    },
    {
      "module_id": "src/store.ts",
      "rule": "circular_dependency",
      "evidence": { "in_cycle": true, "cycle": ["src/cache.ts", "src/store.ts"] },
      "severity": "medium"
    }
  ]
}
```

`repo.commit` / `repo.url` / `repo.analyzed_at` bu JSON'a KASITLI OLARAK
dahil değil — golden-file testi bunları ayrı, dinamik assertion'larla
doğrulayacak (`repo.commit === o çalıştırmadaki gerçek HEAD SHA`,
`repo.url === null` — temp repo'da remote yok, `repo.analyzed_at ===
asOf.toISOString()`). Bir git SHA'sını "golden" bir sabite dondurmak
kırılgan olurdu; bu üçü "doğru hesaplandı mı" değil "ortamdan doğru okundu
mu" sorusuna cevap veriyor.

**`high_hotspot` riski YOK** — en yüksek `hotspot_score` 0.6 (cache.ts),
eşik 0.7'nin altında. Bu fixture'ı zorlayarak tetiklemedim (bkz. tasarım
tartışması); `high_hotspot`'un gerçekten tetiklendiği ayrı, sentetik bir
`risk-rules.test.ts` ile test edilecek.

## NaN → null doğrulaması (varsayılmayacak, açıkça test edilecek)

```ts
const result = await analyzeRepository(repoPath, { asOf: FIXED_DATE });
const standalone = result.modules.find(m => m.id === 'src/standalone.ts')!;
expect(Number.isNaN(standalone.instability)).toBe(true);           // HAM sonuç

const serialized = JSON.parse(JSON.stringify(result));
expect(
  serialized.modules.find((m: { id: string }) => m.id === 'src/standalone.ts').instability
).toBeNull();                                                       // serileştirilmiş sonuç
```

## Test edilmeyen varsayılan davranış (sessizce bırakılmadı)

`analyzeRepository`'nin `asOf` parametresi opsiyonel, varsayılanı
`new Date()`. **Bu golden-file testi (ve tüm diğer testler) `asOf`'u HER
ZAMAN sabit bir değerle enjekte ediyor** — yani `new Date()` varsayılan
davranışının kendisi hiçbir testte alıştırılmıyor/doğrulanmıyor. Bu,
`analyzeRepository`'nin kaynak kodunda açık bir yorumla belirtilecek.
