# EXPECTED — complex-functions fixture

Bu fixture, `packages/engine`'deki **cyclomatic complexity** metriğinin
(`ts-morph` ile implemente edilecek) test edileceği elle hesaplanmış
beklenen değerleri içerir. `simple-project` ve `cyclic-project`'in hemen
hemen hiç dallanması yok (tek istisna: `notificationService.ts`'te bir
`if`) — complexity'yi anlamlı test edecek malzeme yoktu, bu yüzden bu
üçüncü fixture bilerek dallanma/döngü/switch içerecek şekilde tasarlandı.

## Kural seti (McCabe cyclomatic complexity, JS/TS'e uyarlanmış)

Her fonksiyon **1 (temel yol)** ile başlar, ve aşağıdaki her düğüm türü
için **+1** eklenir:

| yapı | AST düğümü | +1 mi? |
|---|---|:---:|
| `if` / `else if` | her `IfStatement` | ✅ |
| düz `else` (koşulsuz) | (ayrı bir düğüm değil) | ❌ |
| ternary `?:` | `ConditionalExpression` | ✅ |
| `for`, `for-in`, `for-of` | `ForStatement`/`ForInStatement`/`ForOfStatement` | ✅ |
| `while`, `do-while` | `WhileStatement`/`DoStatement` | ✅ |
| `switch`'te her `case` | `CaseClause` | ✅ |
| `switch`'te `default` | `DefaultClause` | ❌ |
| `catch` bloğu | `CatchClause` | ✅ |
| `&&` | `BinaryExpression` (operator `&&`) | ✅ |
| `\|\|` | `BinaryExpression` (operator `\|\|`) | ✅ |
| `??` | `BinaryExpression` (operator `??`) | ✅ |
| optional chaining `?.` | — | ❌ (bilinçli, kapsam dışı) |

**Dosya seviyesi complexity = o dosyadaki her fonksiyonun complexity'sinin
TOPLAMI.** Bir dosyada 3 fonksiyon varsa, dosyanın sayısı üçünün
toplamıdır — tek bir "en karmaşık fonksiyon" değil. Gerekçe:
`docs/adr/0003-file-level-complexity-is-sum-of-functions.md`.

**Desteklenen fonksiyon türleri**: `function` bildirimleri
(`FunctionDeclaration`), fonksiyon ifadeleri (`FunctionExpression`), ve ok
fonksiyonları (`ArrowFunction`) — iç içe olsalar bile. Class metodları/
getter-setter/constructor şu an desteklenmiyor (test edilmedi, kapsam
dışı — CodeAtlas'ın kendi kod tabanında hiç class yok, bu yüzden
self-analysis'i etkilemiyor).

**İç içe fonksiyonlar çift sayılmaz**: bir fonksiyonun complexity'si
hesaplanırken, içindeki başka bir fonksiyonun/ok fonksiyonunun gövdesine
inilmez — o iç fonksiyon kendi ayrı complexity'sine sahip, ayrı bir
"fonksiyon" olarak sayılır. `retryWithLogging.ts` bunu özellikle test
ediyor.

## Dosya bazında elle hesaplama

### `src/riskLevel.ts` — 1 fonksiyon

```ts
export function riskLevel(score: number, isFlagged: boolean): string {
  if (score > 90 || isFlagged) {        // IfStatement +1, || +1
    return 'critical';
  } else if (score > 70 && score <= 90) { // IfStatement (nested) +1, && +1
    return 'high';
  } else if (score > 40) {                // IfStatement (nested) +1
    return 'medium';
  }
  return 'low';
}
```
- base: 1
- `if (... || ...)`: IfStatement +1, `||` +1 → +2
- `else if (... && ...)`: IfStatement +1, `&&` +1 → +2
- `else if (score > 40)`: IfStatement +1 → +1
- **`riskLevel` = 1+2+2+1 = 6**

**Dosya toplamı: 6**

### `src/formatMessage.ts` — 1 fonksiyon

```ts
export function formatMessage(user: { name: string } | null, count: number): string {
  const label = count === 1 ? 'item' : 'items';   // ternary +1
  const displayName = user?.name ?? 'Guest';       // ?. yok say, ?? +1
  return `${displayName} has ${count} ${label}`;
}
```
- base: 1
- ternary (`count === 1 ? ... : ...`): +1
- `??` (`user?.name ?? 'Guest'`): +1 (`?.` sayılmıyor)
- **`formatMessage` = 1+1+1 = 3**

**Dosya toplamı: 3**

### `src/processQueue.ts` — 1 fonksiyon

```ts
export function processQueue(items: number[]): number[] {
  const results: number[] = [];
  for (const item of items) {         // ForOfStatement +1
    let value = item;
    while (value > 10) {              // WhileStatement +1
      value = value / 2;
    }
    switch (true) {
      case value < 0:                 // CaseClause +1
        results.push(0);
        break;
      case value === 0:               // CaseClause +1
        results.push(0);
        break;
      default:                        // DefaultClause, sayılmıyor
        results.push(value);
    }
  }
  return results;
}
```
- base: 1
- `for...of`: +1
- `while`: +1
- `case value < 0`: +1
- `case value === 0`: +1
- `default`: +0
- **`processQueue` = 1+1+1+1+1 = 5**

**Dosya toplamı: 5**

### `src/retryWithLogging.ts` — 2 fonksiyon (biri iç içe)

```ts
export function retryWithLogging(fn: () => number, attempts: number): number {
  const logError = (err: unknown): void => {   // <- ayrı fonksiyon, ayrı sayılır
    if (err instanceof Error) {                // (logError'a ait: IfStatement +1)
      console.error(err.message);
    }
  };

  for (let i = 0; i < attempts; i++) {          // ForStatement +1 (retryWithLogging'e ait)
    try {
      return fn();
    } catch (err) {                             // CatchClause +1 (retryWithLogging'e ait)
      logError(err);
    }
  }
  return -1;
}
```

`logError` (iç içe ok fonksiyonu):
- base: 1
- `if (err instanceof Error)`: +1
- **`logError` = 2**

`retryWithLogging` (dış fonksiyon — `logError`'un GÖVDESİ dahil edilmez,
sadece `logError`'un kendi bildirim satırı `retryWithLogging`'in
gövdesinde durur ama içine inilmez):
- base: 1
- `for (let i = 0; ...)`: +1
- `catch (err)`: +1
- **`retryWithLogging` = 3** (4 DEĞİL — eğer iç içe fonksiyon yanlışlıkla
  dışarıya sızsaydı 4 olurdu; bu, implementasyonun doğru izole ettiğini
  test eden kasıtlı bir kontrol noktası)

**Dosya toplamı: 3 + 2 = 5**

## Özet tablo (ts-morph çalıştırılıp doğrulanmadan ÖNCEKİ tahmin)

| module_id                          | fonksiyon say. | cyclomatic_complexity |
|--------------------------------------|:---:|:---:|
| src/riskLevel.ts                      | 1 | 6 |
| src/formatMessage.ts                  | 1 | 3 |
| src/processQueue.ts                   | 1 | 5 |
| src/retryWithLogging.ts               | 2 | 5 |

---

## Gerçek `ts-morph` çıktısıyla çapraz doğrulama (implementasyon kodundan ÖNCE)

Süre kısıtı nedeniyle onay beklenmeden ilerlendi: yukarıdaki tahmin yazıldıktan
SONRA, `ts-morph`'un gerçek AST'sini yukarıdaki kural setiyle birebir
uygulayan bağımsız bir script (geçici, `packages/engine/tests/` altında
çalıştırılıp silindi — implementasyon kodunun kendisi değil, sadece
doğrulama amaçlı) bu dört dosyaya karşı çalıştırıldı. Ham çıktı:

```
riskLevel.ts: functions=[riskLevel=6] fileTotal=6
formatMessage.ts: functions=[formatMessage=3] fileTotal=3
processQueue.ts: functions=[processQueue=5] fileTotal=5
retryWithLogging.ts: functions=[retryWithLogging=3, <anonymous/arrow>=2] fileTotal=5
```

**Sonuç: 4/4 dosya, elle hesaplanan tahminle BİREBİR eşleşti.** Özellikle
kritik olan `retryWithLogging.ts` satırı: dış fonksiyon **3** çıktı (4
DEĞİL) — yani iç içe ok fonksiyonunun (`logError`) gövdesi dış fonksiyona
sızmadı, doğru izole edildi. Herhangi bir tutarsızlık bulunmadığı için
fixture veya kural setinde düzeltme gerekmedi.

## Nihai özet tablo (doğrulanmış)

| module_id                          | fonksiyon say. | cyclomatic_complexity |
|--------------------------------------|:---:|:---:|
| src/riskLevel.ts                      | 1 | 6 |
| src/formatMessage.ts                  | 1 | 3 |
| src/processQueue.ts                   | 1 | 5 |
| src/retryWithLogging.ts               | 2 | 5 |

## Hotspot fusion (Adım 2) — sentetik churn verisiyle

Bu bölüm `computeHotspotScore`'u test ediyor. **Önemli netlik**: bu
fixture'ın gerçek bir git geçmişi yok. Yukarıdaki complexity sayıları
gerçek (`ts-morph` ile doğrulandı). Aşağıdaki churn sayıları ise **sentetik
— elle seçilmiş, gerçek git'ten gelmiyor** (git parsing'in kendisi zaten
`fixtures/churn-repo/EXPECTED.md`'de ayrı test edildi). Amaç: füzyon
formülünün matematiğini, gerçekçi ama kontrollü sayılarla test etmek.

Normalizasyon yöntemi ve formülü: `docs/adr/0004-percentile-rank-normalization-for-hotspot-fusion.md`.

### Sentetik churn girdisi

| module_id                | churn_commits |
|---------------------------|:---:|
| src/riskLevel.ts          | 8 |
| src/formatMessage.ts      | 1 |
| src/processQueue.ts       | 1 |
| src/retryWithLogging.ts   | (hiç yok → füzyonda 0 kabul edilir) |
| src/deletedLegacy.ts      | 15 (**hayalet** — complexity listesinde yok, artık var olmayan bir dosyayı temsil ediyor; füzyon çıktısından VE normalizasyon popülasyonundan tamamen atılmalı) |

### Hesaplama (n=4 — `deletedLegacy.ts` popülasyona hiç dahil değil)

`normalized(x) = |{v < x}| / (n-1)`, n=4 → payda=3.

**Complexity popülasyonu**: `[3, 5, 5, 6]` (formatMessage, processQueue, retryWithLogging, riskLevel)
- formatMessage (3): count(<3)=0 → 0/3 = **0.000**
- processQueue (5): count(<5)=1 (sadece 3) → 1/3 = **0.333**
- retryWithLogging (5): count(<5)=1 (sadece 3) → 1/3 = **0.333**
- riskLevel (6): count(<6)=3 (3,5,5) → 3/3 = **1.000**

**Churn popülasyonu**: `[0, 1, 1, 8]` (retryWithLogging=0, formatMessage=1, processQueue=1, riskLevel=8)
- retryWithLogging (0): count(<0)=0 → 0/3 = **0.000**
- formatMessage (1): count(<1)=1 (sadece 0) → 1/3 = **0.333**
- processQueue (1): count(<1)=1 → 1/3 = **0.333**
- riskLevel (8): count(<8)=3 (0,1,1) → 3/3 = **1.000**

### Özet tablo

| module_id              | complexity | churn | norm_complexity | norm_churn | hotspot_score |
|--------------------------|---:|---:|---:|---:|---:|
| src/formatMessage.ts      | 3 | 1 | 0.000 | 0.333 | **0.000** |
| src/processQueue.ts       | 5 | 1 | 0.333 | 0.333 | **0.111** |
| src/retryWithLogging.ts   | 5 | 0 | 0.333 | 0.000 | **0.000** |
| src/riskLevel.ts          | 6 | 8 | 1.000 | 1.000 | **1.000** |

`src/deletedLegacy.ts` **çıktıda hiç görünmemeli** (4 kayıt, 5 değil).

**Yorum**: `retryWithLogging.ts` yüksek complexity'ye (5) sahip ama bu
pencerede hiç değişmemiş → hotspot_score sıfır (karmaşık ama durağan kod,
şu an acil değil). `riskLevel.ts` hem en karmaşık hem en çok değişen →
net #1 hotspot (1.000).

## Kenar durum: tüm değerler eşitse → hepsi `normalized = 0.0` (1.0 DEĞİL)

`docs/adr/0004-percentile-rank-normalization-for-hotspot-fusion.md`'de
detaylandırıldığı gibi: formül **kesin olarak daha küçük olan değerlerin
sayısını** kullanıyor (`count(v < x)`, `<=` değil). Popülasyondaki
HERKESİN değeri aynıysa, hiç kimse "birinden daha büyük" değildir — bu
yüzden hepsi **0.0** alır, sezgisel olarak beklenebilecek 1.0 (herkes
maksimumda) veya 0.5 değil.

**Örnek**: 3 modülün de `cyclomatic_complexity = 5` olduğu bir popülasyon:
- Her biri için count(<5) = 0 → 0/(3-1) = **0.000** (üçü için de aynı)

Bu bug değil, formülün kesin (strict `<`) tanımının doğal ve dokümante
edilmiş bir sonucu — bir unit test bunu özellikle doğruluyor.
