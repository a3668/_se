-- 選擇題/是非題的標準答案。choice:大寫字母依序(如 'B'、'ACD');truefalse:'T' / 'F';問答題為 NULL
ALTER TABLE questions ADD COLUMN correct TEXT;

-- ⚠ 標記的題目各家解答常有分歧,請再確認

UPDATE questions SET correct = 'A', answer = 'Shared memory 建立後存取不需經過 kernel,通常比 message passing 快;message passing 適合少量資料。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 2 AND type = 'choice';

UPDATE questions SET correct = 'D', answer = '沒有緩衝(zero capacity)時,sender 必須 block 到 receiver 收到訊息(rendezvous)。(a) OS 通常避免搬移 process 以保留 cache(processor affinity);(b) 固定優先權造成的是低優先權 process 飢餓;(c) 同一 process 的 threads 可在多核心上同時執行。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 3 AND type = 'choice';

-- ⚠ 也有解答給 (c):shared memory 建立後讀寫不需 kernel,但建立(shmget/mmap)仍須 system call
UPDATE questions SET correct = 'E', answer = '四種機制都需要 kernel 介入:message passing、RPC、socket 每次傳送都要 system call;shared memory 雖然之後讀寫不需 kernel,但建立共享區段仍需 system call。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 5 AND type = 'choice';

UPDATE questions SET correct = 'B', answer = 'P1 與 P3 在不同 CPU 上,關閉其中一顆 CPU 的中斷無法阻止另一顆 CPU 上的 process 進入 critical section。P1、P2 同一顆 CPU 用關中斷可行;跨 CPU 用 spinlock 合理。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 6 AND type = 'choice';

UPDATE questions SET correct = 'BC', answer = '(A) 多處理器上關中斷只影響單一 CPU,不可行;(D) 使用 waiting queue 的 semaphore 仍可能發生 deadlock(如兩個 process 以相反順序 wait 兩個 semaphore)。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 8 AND type = 'choice';

UPDATE questions SET correct = 'D', answer = 'Zero capacity 沒有緩衝區,sender 必須 block 直到 receiver 收到,不能使用 non-blocking send。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 10 AND type = 'choice';

UPDATE questions SET correct = 'B', answer = 'Race condition 發生在多個 thread 同時存取「並修改」共享資料,且結果取決於執行順序。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 11 AND type = 'choice';

UPDATE questions SET correct = 'A', answer = '單處理器上 spinning 會佔用唯一的 CPU,持有鎖的 process 無法執行來釋放鎖,只是浪費 CPU 時間。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 15 AND type = 'choice';

UPDATE questions SET correct = 'C', answer = 'X=X+1 會被編譯成 load、add、store 多個指令,不是 atomic,中途被切換就可能產生 race condition。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 17 AND type = 'choice';

UPDATE questions SET correct = 'ABC', answer = '(D) 錯:在多處理器系統中,鎖持有時間短時 busy waiting(spinlock)反而有效率,因為免去 context switch,所以仍廣泛使用。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 18 AND type = 'choice';

UPDATE questions SET correct = 'ACD', answer = '(B) 錯:一般的 i++ 是 load-add-store,沒有硬體支援時不是 atomic。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 21 AND type = 'choice';

UPDATE questions SET correct = 'D', answer = '多個 process 同時讀寫共享記憶體時,必須由程式自行做同步(例如 semaphore、mutex),OS 不會幫忙。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 22 AND type = 'choice';

-- ⚠ (d) 有些教材認為 semaphore 與 conditional critical region 表達能力等價
UPDATE questions SET correct = 'AC', answer = '(b) 錯:四個條件是 deadlock 的必要條件而非充分條件(資源有多個 instance 時不一定 deadlock),且題目寫的是 deadline;(d) 兩者抽象層次不同,一般不視為等價。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 23 AND type = 'choice';

-- ⚠ (b) 依教材而定
UPDATE questions SET correct = 'ACD', answer = '(b) 錯:標準 UNIX pipe 綁定在同一台機器的 kernel 上,不支援 process migration。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 27 AND type = 'choice';

UPDATE questions SET correct = 'A', answer = '電腦之間沒有共享的記憶體,message passing 比 shared memory 容易實作;但它通常較慢,且是 OS 的 IPC 機制。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 30 AND type = 'choice';

UPDATE questions SET correct = 'F', answer = '只有建立與 mapping(shm_open、mmap)需要 system call;mapping 完成後就是一般的記憶體存取,不需 system call。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 30 AND type = 'truefalse';

UPDATE questions SET correct = 'A', answer = 'Direct communication 必須明確指名對方(send(P, msg)/receive(Q, msg));(b)(c)(d) 都是 indirect communication(mailbox)的特性。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 31 AND type = 'choice';

UPDATE questions SET correct = 'B', answer = '分散式系統中各電腦沒有共享記憶體,message passing 較容易實作。'
WHERE chapter = '第四章:程序之間的溝通及同步問題' AND number = 32 AND type = 'choice';
