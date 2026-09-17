# EXPECTED — cyclic-project fixture

Bu fixture, `packages/engine`'deki **cycle detection (Tarjan's SCC)** ve
**blast radius (BFS)** implementasyonlarının test edileceği elle hesaplanmış
beklenen değerleri içerir. `fixtures/simple-project`'e dokunulmadı; bu ayrı,
kendi başına duran bir fixture.

Senaryo gerçekçi: bir session/auth akışında `tokenStore.refreshToken`,
eski oturumu geçersiz kılmak için `sessionManager.invalidateSession`'ı
çağırıyor — bu da `sessionManager → authService → tokenStore → sessionManager`
şeklinde kasıtlı bir döngü yaratıyor (gerçek projelerde tam olarak böyle
kazayla ortaya çıkan bir circular dependency).

## Ham import edge listesi (from → to)

```
server.ts         → sessionManager.ts
sessionManager.ts → authService.ts
authService.ts    → tokenStore.ts
authService.ts    → logger.ts
tokenStore.ts     → sessionManager.ts
```

**Not — type-only import'lar bilinçli olarak bu listede yok**: `server.ts` ve
`sessionManager.ts`, `tokenStore.ts`'ten `import type { Token }` ile tip
import ediyor. Bunlar yukarıdaki edge listesinde **kasıtlı olarak yok** —
`dependency-cruiser`'ın varsayılan davranışı (`tsPreCompilationDeps: false`),
grafiği derlenmiş/emit edilmiş JavaScript'in çalışma zamanı hâliyle
modelliyor; `import type` derleme sırasında tamamen silindiği (sıfır JS
üretir) için hiç edge olarak görünmüyor — `typeOnly: true` bayraklı bir kayıt
olarak bile değil, tamamen yok. Bu, `packages/engine`'in bilinçli bir kapsam
kararı olarak benimsendi: graph/fan-in/fan-out/instability/cycle/blast-radius
**sadece runtime bağımlılığını** modelliyor, derleme-zamanı tip bağımlılığını
değil. Gerekçe ve trade-off için bkz.
`docs/adr/0002-type-only-imports-excluded-from-graph.md`.

Bu, gerçek `dependency-cruiser` çıktısına karşı doğrulandı (`--output-type json`);
her `dependency`'nin `circular` alanı şunu veriyor:

| edge                                  | circular |
|----------------------------------------|:--------:|
| server.ts → sessionManager.ts          | false    |
| sessionManager.ts → authService.ts     | **true** |
| authService.ts → tokenStore.ts         | **true** |
| authService.ts → logger.ts             | false    |
| tokenStore.ts → sessionManager.ts      | **true** |

## 1. Cycle detection (Tarjan's SCC)

**Tanım**: Bir strongly connected component (SCC), her düğümün diğerine
yönlü kenarlar üzerinden ulaşabildiği maksimal düğüm kümesidir. Boyutu 1'den
büyük olan her SCC bir "cycle"dır (boyutu 1 olan tek-düğümlü SCC'ler, kendine
döngüsü olmadığı sürece cycle sayılmaz).

**Elle izleme**: `sessionManager.ts → authService.ts → tokenStore.ts →
sessionManager.ts` zinciri, bu üç düğümün birbirine karşılıklı ulaşabildiğini
gösteriyor (A→B→C→A). `server.ts` sadece `sessionManager.ts`'e ulaşıyor,
ondan geri kendisine dönen bir yol yok → tek başına bir SCC (cycle değil).
`logger.ts` hiçbir yere gitmiyor (leaf) → tek başına bir SCC (cycle değil).

**Beklenen sonuç**:
```json
"cycles": [
  ["src/sessionManager.ts", "src/authService.ts", "src/tokenStore.ts"]
]
```
(Küme olarak tek bir cycle var; bu 3 modülün array içindeki **sırası**
Tarjan'ın DFS ziyaret sırasına bağlıdır ve semantik olarak önemli değil —
testler bu diziyi sıralanmış bir küme olarak karşılaştıracak, tam sıra
eşleşmesi beklemeyecek.)

**`in_cycle` bayrağı (her modül için)**:

| module_id                  | in_cycle |
|------------------------------|:--------:|
| src/server.ts                 | false    |
| src/sessionManager.ts         | **true** |
| src/authService.ts            | **true** |
| src/tokenStore.ts             | **true** |
| src/logger.ts                 | false    |

## 2. Blast radius (BFS)

**Tanım (bu projede kullanılan konvansiyon)**: `blast_radius(M)` = M
değişirse/bozulursa etkilenebilecek, M'e **doğrudan veya dolaylı olarak
bağımlı olan** modüllerin sayısı. Bu, bağımlılık grafiğinin **ters**
kenarları üzerinde ("kim beni import ediyor" / dependents ilişkisi) M'den
başlayan bir BFS'tir; M'in kendisi sayıma dahil değildir. Cycle içindeki
modüller birbirini karşılıklı etkilediği için birbirlerini de kapsar.

**Ters bağımlılık (dependents) tablosu** — "kim import ediyor":

| module_id            | dependents (bu dosyayı import edenler) |
|------------------------|------------------------------------------|
| src/server.ts          | (yok)                                    |
| src/sessionManager.ts  | src/server.ts, src/tokenStore.ts         |
| src/authService.ts     | src/sessionManager.ts                    |
| src/tokenStore.ts      | src/authService.ts                       |
| src/logger.ts          | src/authService.ts                       |

**Elle BFS (her modül için, kendisi hariç, ters kenarlar üzerinde)**:

- `server.ts`: dependents yok → **blast_radius = 0** (hiçbir şey ona bağımlı
  değil, değiştirmesi en güvenli dosya).
- `sessionManager.ts`: dependents = {server, tokenStore} → tokenStore'un
  dependent'ı authService → authService'in dependent'ı sessionManager
  (zaten başlangıç noktası, tekrar sayılmaz). Ziyaret edilen küme:
  {server, tokenStore, authService} → **blast_radius = 3**.
- `authService.ts`: dependents = {sessionManager} → sessionManager'ın
  dependents'ı {server, tokenStore} → tokenStore'un dependent'ı authService
  (başlangıç, tekrar sayılmaz). Ziyaret edilen küme:
  {sessionManager, server, tokenStore} → **blast_radius = 3**.
- `tokenStore.ts`: dependents = {authService} → authService'in dependents'ı
  {sessionManager} → sessionManager'ın dependents'ı {server, tokenStore}
  (başlangıç, tekrar sayılmaz). Ziyaret edilen küme:
  {authService, sessionManager, server} → **blast_radius = 3**.
- `logger.ts`: dependents = {authService} → authService'in dependents'ı
  {sessionManager} → sessionManager'ın dependents'ı {server, tokenStore}.
  Ziyaret edilen küme: {authService, sessionManager, server, tokenStore}
  → **blast_radius = 4** (proje içindeki her şey, dolaylı olarak, logger'a
  bağımlı — beklenen: bir "leaf" utility'nin blast radius'u en yüksek olur).

**Özet tablo**:

| module_id              | in_cycle | blast_radius |
|--------------------------|:--------:|:------------:|
| src/server.ts            | false    | 0            |
| src/sessionManager.ts    | true     | 3            |
| src/authService.ts       | true     | 3            |
| src/tokenStore.ts        | true     | 3            |
| src/logger.ts            | false    | 4            |

**Sağlama**: Cycle içindeki 3 modülün blast_radius'u birbirine eşit (3) —
bu beklenen bir özellik, çünkü aynı SCC'deki modüller birbirine ulaşabildiği
için (BFS ters yönde de) aynı "yukarı akış" kümesine ulaşırlar artı
birbirlerini kapsarlar. `logger.ts` en yüksek blast radius'a sahip çünkü
zincirin en altında (leaf) — üstündeki her şey (cycle + server) ona dolaylı
bağımlı.

## 3. Coupling metrikleri (referans için, Adım 2'deki formülle)

Bu tablo `computeCouplingMetrics`'in gerçek çıktısıyla çapraz doğrulandı
(`packages/engine`, geçici bir test ile çalıştırılıp silindi). `server.ts`
ve `sessionManager.ts`'in `tokenStore.ts`'e olan `import type { Token }`
bağımlılıkları — yukarıdaki "Not" bölümünde açıklandığı gibi — bu tabloya
**dahil değil**: `server.ts`'in fan_out'u 1 (sadece sessionManager, tokenStore
değil), `sessionManager.ts`'in fan_out'u 1 (sadece authService, tokenStore
değil). Tip bağımlılıkları dahil edilseydi bu iki sayı da 1 artacaktı.

| module_id              | fan_in | fan_out | instability |
|--------------------------|-------:|--------:|------------:|
| src/server.ts            |      0 |       1 |        1.00 |
| src/sessionManager.ts    |      2 |       1 |        0.33 |
| src/authService.ts       |      1 |       2 |        0.67 |
| src/tokenStore.ts        |      1 |       1 |        0.50 |
| src/logger.ts            |      1 |       0 |        0.00 |
