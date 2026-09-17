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
