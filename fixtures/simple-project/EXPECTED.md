# EXPECTED — simple-project fixture

Bu fixture, `packages/engine` içindeki graph builder + metric calculator
unit testlerinin karşılaştırılacağı elle hesaplanmış beklenen değerleri içerir.

Tasarım amacı:
- En az bir doğrusal zincir: `index.ts → userService.ts → database.ts`
  (aynı zamanda `notificationService.ts → userService.ts → database.ts`)
- En az bir dallanma: `index.ts` iki dosyaya bağımlı (`userService.ts`, `orderService.ts`)
  ve `database.ts` iki dosyadan bağımlı hale getiriliyor (yüksek fan-in örneği)
- Döngü yok (cycle detection Adım 3'te ayrı fixture ile ele alınacak)

## Ham import edge listesi (from → to)

```
index.ts               → userService.ts
index.ts               → orderService.ts
userService.ts          → database.ts
orderService.ts         → database.ts
notificationService.ts → userService.ts
```

(Tüm yollar `src/` altında; okunabilirlik için dosya adları kısaltıldı.)

## Tanımlar

- **fan_out (Ce, efferent coupling)**: bu dosyanın import ettiği, projeye ait modül sayısı.
- **fan_in (Ca, afferent coupling)**: bu dosyayı import eden, projeye ait modül sayısı.
- **instability (I)**: `I = Ce / (Ca + Ce)`. Tanımsızlık durumu (Ca=0 ve Ce=0, yani hem
  hiçbir yere bağımlı değil hem de hiç kimse ona bağımlı değil — izole modül) bu
  fixture'da oluşmuyor; her modülün en az bir kenarı var.

## Modül bazında hesaplama

### `src/index.ts`
- fan_out = 2 (`userService.ts`, `orderService.ts` import ediliyor)
- fan_in = 0 (bu dosyayı import eden başka fixture modülü yok)
- instability = 2 / (0 + 2) = **1.0**

### `src/userService.ts`
- fan_out = 1 (sadece `database.ts` import ediliyor)
- fan_in = 2 (`index.ts` ve `notificationService.ts` tarafından import ediliyor)
- instability = 1 / (2 + 1) = **0.333...** (≈ 0.33)

### `src/orderService.ts`
- fan_out = 1 (sadece `database.ts` import ediliyor)
- fan_in = 1 (sadece `index.ts` tarafından import ediliyor)
- instability = 1 / (1 + 1) = **0.5**

### `src/database.ts`
- fan_out = 0 (hiçbir şeyi import etmiyor — leaf modül)
- fan_in = 2 (`userService.ts` ve `orderService.ts` tarafından import ediliyor)
- instability = 0 / (2 + 0) = **0.0**

### `src/notificationService.ts`
- fan_out = 1 (sadece `userService.ts` import ediliyor)
- fan_in = 0 (bu dosyayı import eden başka fixture modülü yok)
- instability = 1 / (0 + 1) = **1.0**

## Özet tablo

| module_id                    | fan_in | fan_out | instability |
|-------------------------------|-------:|--------:|------------:|
| src/index.ts                  |      0 |       2 |        1.00 |
| src/userService.ts            |      2 |       1 |        0.33 |
| src/orderService.ts           |      1 |       1 |        0.50 |
| src/database.ts               |      2 |       0 |        0.00 |
| src/notificationService.ts    |      0 |       1 |        1.00 |

## Sağlamalar (sanity checks)

- Toplam edge sayısı = 5. `sum(fan_out)` = 2+1+1+0+1 = 5, `sum(fan_in)` = 0+2+1+2+0 = 5.
  İkisi eşit olmalı çünkü her edge tam olarak bir dosyanın fan_out'una,
  bir dosyanın fan_in'ine katkı yapar.
- `database.ts` en kararlı (I=0, "stable" — çok bağımlı ama kendisi kimseye bağımlı değil).
- `index.ts` ve `notificationService.ts` en kararsız (I=1.0, "instable" — giriş noktaları,
  başkası onlara bağımlı değil).
- Cycle yok: graph bir DAG (Directed Acyclic Graph) — bu ileride Tarjan SCC testinin
  "sıfır cycle bulmalı" negatif kontrolü olarak da kullanılabilir.
