-- 問答題參考答案(精簡版)
UPDATE questions SET answer = '1. **Spinlock**:單處理器上,等待鎖的 process 一直 spin 會佔住唯一的 CPU,持有鎖的 process 無法執行來釋放鎖,只會浪費 CPU 時間,直到 time slice 用完。多處理器上,持有鎖的 process 在另一顆 CPU 上執行,鎖很快就會釋放,spin 一下的成本比 context switch 小。
2. **關中斷**:關中斷是特權指令,user-level 程式不能執行。就算允許,user 程式也可能一直不開中斷,讓 timer 中斷失效、獨占 CPU,系統就無法排班。
3. **Swap 達成 bounded waiting**:用 `waiting[n]` 陣列與共享的 `lock`。process i 設 `waiting[i]=true; key=true;`,在 `while (waiting[i] && key) Swap(&lock, &key);` 迴圈中等待。離開 critical section 時,依 (i+1)…(i+n-1) 的順序找下一個 `waiting[j]==true` 的 j:找到就設 `waiting[j]=false` 把進入權交給 j,沒有就設 `lock=false`。因此任何等待者最多等 n−1 輪。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 4 AND type = 'essay';

UPDATE questions SET answer = '可能的結果為 **3、4、6**。
- 依序執行(無交錯):5+1−2 = 4。
- 兩者都先讀到 5:+1 的結果最後寫回,得 6;−2 的結果最後寫回,得 3。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 7 AND type = 'essay';

UPDATE questions SET answer = '關中斷是特權指令,user mode 無法執行;即使可以,user 程式可能長時間甚至永久不開中斷,使 timer 中斷失效,OS 無法搶回 CPU,系統安全與排班都會被破壞。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 9 AND type = 'essay';

UPDATE questions SET answer = 'a) 需要 `fork()` 建立子 process、`exec()` 載入要執行的程式,父 process 再用 `wait()` 等待子 process 結束。
b) **Shared memory**:建立後直接讀寫記憶體,速度快、適合大量資料,但需要程式自行同步。**Message passing**:透過 kernel 的 send/receive,容易實作、沒有衝突問題,適合少量資料與分散式系統,但每次傳送都要 system call,較慢。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 12 AND type = 'essay';

UPDATE questions SET answer = 'withdraw 和 deposit 都是「讀 balance → 計算 → 寫回」。例如 balance=100,先生 withdraw(50)、太太 deposit(30):兩人都讀到 100,先生寫回 50、太太寫回 130,後寫回的值覆蓋前者,最後結果是 50 或 130,而不是正確的 80。
**解法**:把讀寫 balance 的程式碼視為 critical section,用 mutex lock 或 semaphore 保護,使兩個函式互斥執行。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 13 AND type = 'essay';

UPDATE questions SET answer = '(a) 單處理器上 spin 會浪費唯一的 CPU,持有鎖的 process 無法執行;多處理器上鎖持有時間短,spin 比 context switch 划算。
(b) 多個 process 同時存取並修改共享資料,結果取決於執行順序。例如兩個 process 同時執行 `counter++`,結果可能只加 1。
(c) 一組 process 中,每個都在等待另一個 process 持有的資源,所有 process 都無法繼續執行。
(d) Deadlock 的四個必要條件:mutual exclusion、hold and wait、no preemption、circular wait。破壞其中任一個即可預防 deadlock。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 14 AND type = 'essay';

UPDATE questions SET answer = '**Shared memory**:OS 只負責建立共享區段並 map 到各 process 的位址空間,之後的讀寫不經過 kernel,速度快、適合大量資料,但同步要由程式自行處理(semaphore 等)。
**IPC / message passing**:每次 send/receive 都由 OS kernel 負責複製與傳遞,並處理 blocking 與緩衝;容易使用、不會衝突,也適用於分散式系統,但有 system call 與資料複製的成本,較慢。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 19 AND type = 'essay';

UPDATE questions SET answer = '1. Shared memory 與 message passing。
2. 多個 process 同時存取並修改共享資料,且結果取決於執行順序時。
3. Mutual exclusion、progress、bounded waiting。
4. **Prevention**:靜態破壞四個必要條件之一,確保 deadlock 不可能發生。**Avoidance**:執行時依事先知道的資源需求(如 Banker''s algorithm)判斷每次配置是否安全,只允許維持 safe state 的配置。
5. 高優先權 process 等待低優先權 process 持有的鎖,而低優先權 process 又被中優先權 process 搶占,高優先權 process 因此被間接延遲。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 20 AND type = 'essay';

UPDATE questions SET answer = '單處理器上,spinning 的 thread 佔住 CPU,持有鎖的 thread 無法執行來釋放鎖,spin 完全是浪費。多處理器上,持有者在其他 CPU 執行且通常很快釋放,短暫 spin 比 sleep/wakeup 的 context switch 成本低。因此單處理器上這些系統改用關閉 kernel preemption 或中斷的方式。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 24 AND type = 'essay';

UPDATE questions SET answer = '1. 多個 process 同時存取並修改共享資料,結果取決於執行順序;用 mutex、semaphore 等同步機制保護 critical section 即可解決。
2. Prevention 靜態破壞 deadlock 必要條件之一;avoidance 執行時依資源需求資訊(Banker''s algorithm)確保系統維持 safe state。
3. Thread 需要等待某個條件成立(例如 buffer 非空)才能繼續時,可搭配 mutex 用 wait/signal,不必 busy waiting。
4. **Asynchronous**:立即終止目標 thread,可能留下不一致的資源。**Deferred**:目標 thread 定期檢查 cancellation point,在安全的位置自行結束。
5. Normal exit(正常結束)、error exit(主動錯誤結束)、fatal error(如非法存取,被 OS 終止)、被其他 process kill。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 25 AND type = 'essay';

UPDATE questions SET answer = '1. 確保四個必要條件至少一個不成立:
   - mutual exclusion:資源可共享時不必互斥。
   - hold and wait:一次要求全部資源,或持有資源時不可再要求。
   - no preemption:要求不到時釋放已持有的資源。
   - circular wait:替資源編號,只能依遞增順序要求。
2. Mutual exclusion、progress、bounded waiting。
3. 高優先權 process 等待低優先權 process 持有的資源,而低優先權 process 被中優先權 process 搶占。解法是 priority inheritance:持有資源的低優先權 process 暫時繼承高優先權,直到釋放資源。
4. 若一個 non-serial schedule 可透過交換不衝突的相鄰操作,轉換成某個 serial schedule,就稱為 conflict serializable。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 26 AND type = 'essay';

UPDATE questions SET answer = '**Shared memory**:合作的 process 共享一塊記憶體區域,直接讀寫來交換資料。只有建立時需要 kernel,速度快,但需自行同步。
**Message passing**:process 透過 kernel 提供的 send/receive 交換訊息,不共享位址空間。適合少量資料與分散式系統,但每次都要 system call,較慢。可分為 direct/indirect、同步/非同步、不同的緩衝容量。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 29 AND type = 'essay';
