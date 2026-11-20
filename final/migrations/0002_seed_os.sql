-- 初始題庫:作業系統第四章,資料來自 hw7 題庫(題目、標準答案、詳解)
-- 由 hw7 的 migrations 匯出後轉成新資料表格式

INSERT INTO courses (id, slug, name, description, sort_order) VALUES
(1, 'os', '作業系統', '作業系統課程考古題,含選擇、是非與問答題。', 1);

INSERT INTO chapters (id, course_id, title, sort_order) VALUES
(1, 1, '第四章:程序之間的溝通及同步問題', 1),
(2, 1, '第四章:程序之間的溝通及同步問題(p4-26 起)', 2);

INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (1, 1, 2, 'choice', 'Which of the following statements is true regarding the Interprocess communication?

(A) Shared memory is typically faster than message passing.
(B) Message passing is typically faster than shared memory.
(C) Message passing is most useful for exchanging large amounts of data.
(D) Shared memory is far more common in operating systems than message passing.', 'Shared memory 建立後存取不需經過 kernel,通常比 message passing 快;message passing 適合少量資料。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (2, 1, 3, 'choice', 'Which of the following statements is correct?

(a) Operating systems usually move processes from one processor to another to improve cache usability.
(b) Fixing process priorities results in starvation of high-priority processes.
(c) Two threads of a process cannot simultaneously perform on a multicore processor.
(d) During inter-process communication, a sender process has to block until the recipient receives the message if there is no message buffering.
(e) None of the above statements are correct.', '沒有緩衝(zero capacity)時,sender 必須 block 到 receiver 收到訊息(rendezvous)。(a) OS 通常避免搬移 process 以保留 cache(processor affinity);(b) 固定優先權造成的是低優先權 process 飢餓;(c) 同一 process 的 threads 可在多核心上同時執行。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (3, 1, 4, 'essay', '9. (15%) (part-1) Explain why spinlocks are not appropriate for single-processor systems yet are often used in multiprocessor systems. (part-2) Explain why implementing synchronization primitives by disabling interrupts is not appropriate in single-processor system if the synchronization primitives are to be used in user-level programs. (part-3) Describe how the Swap() instruction can be used to provide mutual exclusion that satisfies the bounded-waiting requirement.', '1. **Spinlock**:單處理器上,等待鎖的 process 一直 spin 會佔住唯一的 CPU,持有鎖的 process 無法執行來釋放鎖,只會浪費 CPU 時間,直到 time slice 用完。多處理器上,持有鎖的 process 在另一顆 CPU 上執行,鎖很快就會釋放,spin 一下的成本比 context switch 小。
2. **關中斷**:關中斷是特權指令,user-level 程式不能執行。就算允許,user 程式也可能一直不開中斷,讓 timer 中斷失效、獨占 CPU,系統就無法排班。
3. **Swap 達成 bounded waiting**:用 `waiting[n]` 陣列與共享的 `lock`。process i 設 `waiting[i]=true; key=true;`,在 `while (waiting[i] && key) Swap(&lock, &key);` 迴圈中等待。離開 critical section 時,依 (i+1)…(i+n-1) 的順序找下一個 `waiting[j]==true` 的 j:找到就設 `waiting[j]=false` 把進入權交給 j,沒有就設 `lock=false`。因此任何等待者最多等 n−1 輪。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (4, 1, 5, 'choice', '5. (6%) For two processes on the same machine to communicate with each other, which of the following mechanisms do not require any kernel intervention at all?

(a) Message passing.
(b) Remote procedure call.
(c) Shared memory.
(d) TCP/IP socket.
(e) All of the above require some kernel intervention.', '四種機制都需要 kernel 介入:message passing、RPC、socket 每次傳送都要 system call;shared memory 雖然之後讀寫不需 kernel,但建立共享區段仍需 system call。', 'E');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (5, 1, 6, 'choice', 'Consider a two-processor system running three processes P1, P2, and P3. The processes P1 and P2 run on the first CPU, while the process P3 runs on the second CPU. All these three processes share one mutually exclusive resource. Suppose that processes never migrate from a CPU to the other one. In terms of CPU utilization and hardware cost, which one of the following design options is improper?

(A) Using interrupt disabling to synchronize processes P1 and P2.
(B) Using interrupt disabling to synchronize processes P1 and P3.
(C) Using spin locks to synchronize processes P1 and P3.
(D) None of the above.', 'P1 與 P3 在不同 CPU 上,關閉其中一顆 CPU 的中斷無法阻止另一顆 CPU 上的 process 進入 critical section。P1、P2 同一顆 CPU 用關中斷可行;跨 CPU 用 spinlock 合理。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (6, 1, 7, 'essay', 'Suppose that a process is executing “counter = counter + 1” while another process is executing concurrently (without any synchronization) “counter = counter − 2”, where the counter is a variable shared between the two processes and is only changed in those statements. Given that the value of counter is five before execution, give all the possible value(s) after both processes finish their statement. (7%)', '可能的結果為 **3、4、6**。
- 依序執行(無交錯):5+1−2 = 4。
- 兩者都先讀到 5:+1 的結果最後寫回,得 6;−2 的結果最後寫回,得 3。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (7, 1, 8, 'choice', '6. Which are correct for synchronization?

(A) Disabling interrupts on a multiprocessor is a feasible way for solving the critical-section problem.
(B) The TestAndSet() and Swap() instructions are two special hardware instructions for solving the critical-section problem.
(C) Using spinlocks is a good approach in a multiprocessor system.
(D) Deadlocks never happen in the implementation of a semaphore with a waiting queue.', '(A) 多處理器上關中斷只影響單一 CPU,不可行;(D) 使用 waiting queue 的 semaphore 仍可能發生 deadlock(如兩個 process 以相反順序 wait 兩個 semaphore)。', 'BC');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (8, 1, 9, 'essay', '(5 points) Explain why implementing synchronization primitives by disabling interrupts is not appropriate in a single-processor system if the synchronization primitives are to be used in a user-level program.', '關中斷是特權指令,user mode 無法執行;即使可以,user 程式可能長時間甚至永久不開中斷,使 timer 中斷失效,OS 無法搶回 CPU,系統安全與排班都會被破壞。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (9, 1, 10, 'choice', 'Which of the following statements is wrong regarding the Interprocess Communication?

(A) Message passing is easier to implement in a distributed system than shared memory.
(B) For direct communication, a link is established automatically between every pair of processes that want to communicate.
(C) For indirect communication, between each pair of communicating processes, there may be a number of different links, with each link corresponding to one mailbox.
(D) As for the message passing systems, “non-blocking send” can be used in the case of “zero capacity” buffering.', 'Zero capacity 沒有緩衝區,sender 必須 block 直到 receiver 收到,不能使用 non-blocking send。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (10, 1, 11, 'choice', 'A race condition \_\_\_\_.

(A) results when several threads try to access the same data concurrently
(B) results when several threads try to access and modify the same data concurrently
(C) will result only if the outcome of execution does not depend on the order in which instructions are executed
(D) None of the above', 'Race condition 發生在多個 thread 同時存取「並修改」共享資料,且結果取決於執行順序。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (11, 1, 12, 'essay', '[System Structures] Please answer the followings:

a) (3%) What system calls have to be executed by a command interpreter or shell in order to start a new process?
b) (4%) What are the two modes of interprocess communication? What are the strengths and weaknesses of the two approaches?', 'a) 需要 `fork()` 建立子 process、`exec()` 載入要執行的程式,父 process 再用 `wait()` 等待子 process 結束。
b) **Shared memory**:建立後直接讀寫記憶體,速度快、適合大量資料,但需要程式自行同步。**Message passing**:透過 kernel 的 send/receive,容易實作、沒有衝突問題,適合少量資料與分散式系統,但每次傳送都要 system call,較慢。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (12, 1, 13, 'essay', '[Synchronization] (5%) Race conditions are possible in many computer systems. Consider a banking system that maintains an account balance with two functions: deposit(amount) and withdraw(amount). These two functions are passed the amount that is to be deposited or withdrawn from the bank account balance. Assume that a husband and wife share a bank account. Concurrently, the husband calls the withdraw() function and the wife calls deposit(). Describe how a race condition is possible and what might be done to prevent the race condition from occurring.', 'withdraw 和 deposit 都是「讀 balance → 計算 → 寫回」。例如 balance=100,先生 withdraw(50)、太太 deposit(30):兩人都讀到 100,先生寫回 50、太太寫回 130,後寫回的值覆蓋前者,最後結果是 50 或 130,而不是正確的 80。
**解法**:把讀寫 balance 的程式碼視為 critical section,用 mutex lock 或 semaphore 保護,使兩個函式互斥執行。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (13, 1, 14, 'essay', '(16 分) Please answer following questions about Synchronization and Deadlock:

(a) Explain why spinlocks are not appropriate for single-processor systems yet are often used in multiprocessor systems? (4 分)
(b) Explain what is race condition? Please give an example. (4 分)
(c) Explain what is deadlock? (4 分)
(d) Name the four conditions that prevent deadlock. (4 分)', '(a) 單處理器上 spin 會浪費唯一的 CPU,持有鎖的 process 無法執行;多處理器上鎖持有時間短,spin 比 context switch 划算。
(b) 多個 process 同時存取並修改共享資料,結果取決於執行順序。例如兩個 process 同時執行 `counter++`,結果可能只加 1。
(c) 一組 process 中,每個都在等待另一個 process 持有的資源,所有 process 都無法繼續執行。
(d) Deadlock 的四個必要條件:mutual exclusion、hold and wait、no preemption、circular wait。破壞其中任一個即可預防 deadlock。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (14, 1, 15, 'choice', '[5 pts.] Spinlock synchronization schemes are “not” appropriate in which system?

(A) Single processor system
(B) Multi core system
(C) Multi-processor system
(D) Multiple computer system
(E) Real Time system', '單處理器上 spinning 會佔用唯一的 CPU,持有鎖的 process 無法執行來釋放鎖,只是浪費 CPU 時間。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (15, 1, 17, 'choice', 'We illustrated the idea of the need for synchronization between processes by showing a problem with an instruction like X=X+1. What was the problem with this instruction?

(A) The compiler left a number in a register.
(B) The compiler produced code that was not reentrant.
(C) It was not atomic.
(D) Modern pipelined CPUs would execute things in the wrong order.
(E) None of the above explains the problem with this instruction.', 'X=X+1 會被編譯成 load、add、store 多個指令,不是 atomic,中途被切換就可能產生 race condition。', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (16, 1, 18, 'choice', '4. Which statements are correct?

(A) Busy waiting is the situation that a process is waiting for an event while it is executing instructions in a loop in the running state.
(B) A spinlock is a lock which causes a thread trying to acquire it using busy waiting.
(C) Rather than busy waiting, the process can block itself. The block operation places a process into a waiting queue and sleep.
(D) Busy waiting is not efficient and does not use anymore in a multiprocessor system.', '(D) 錯:在多處理器系統中,鎖持有時間短時 busy waiting(spinlock)反而有效率,因為免去 context switch,所以仍廣泛使用。', 'ABC');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (17, 1, 19, 'essay', '[10%] When multiple processes need to cooperate, there is a choice between shared memory and inter-process communication (IPC). Compare and contrast these two techniques. Make sure to clarify the role of the operating system in each.', '**Shared memory**:OS 只負責建立共享區段並 map 到各 process 的位址空間,之後的讀寫不經過 kernel,速度快、適合大量資料,但同步要由程式自行處理(semaphore 等)。
**IPC / message passing**:每次 send/receive 都由 OS kernel 負責複製與傳遞,並處理 blocking 與緩衝;容易使用、不會衝突,也適用於分散式系統,但有 system call 與資料複製的成本,較慢。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (18, 1, 20, 'essay', '[Process Management: 15%]

1. Explain the two basic models of inter-process communication. (4%)
2. When will a race condition occur? (2%)
3. What are the three requirements that a critical-section solution should meet? (3%)
4. What is the difference between deadlock prevention and deadlock avoidance? (4%)
5. When will priority inversion occur in process synchronization? (2%)', '1. Shared memory 與 message passing。
2. 多個 process 同時存取並修改共享資料,且結果取決於執行順序時。
3. Mutual exclusion、progress、bounded waiting。
4. **Prevention**:靜態破壞四個必要條件之一,確保 deadlock 不可能發生。**Avoidance**:執行時依事先知道的資源需求(如 Banker''s algorithm)判斷每次配置是否安全,只允許維持 safe state 的配置。
5. 高優先權 process 等待低優先權 process 持有的鎖,而低優先權 process 又被中優先權 process 搶占,高優先權 process 因此被間接延遲。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (19, 1, 21, 'choice', 'Choose the correct statements from the multiple choices regarding atomic transactions.

(A) An un-interruptible unit is known as atomic.
(B) Incrementing an integer value can always be performed atomically.
(C) The TestAndSet instruction is executed atomically.
(D) The mutual exclusion of critical sections ensures that the critical sections are executed atomically.
(E) None of the above.', '(B) 錯:一般的 i++ 是 load-add-store,沒有硬體支援時不是 atomic。', 'ACD');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (20, 1, 22, 'choice', 'Shared memory is a very fast mechanism for interprocess communication because both processes can see any changes instantly. What is the main drawback to shared memory?

(A) It is limited to a small space.
(B) It requires an OS call.
(C) It is limited to two processes at one time.
(D) It may require synchronization.
(E) None of the above is a drawback to shared memory.', '多個 process 同時讀寫共享記憶體時,必須由程式自行做同步(例如 semaphore、mutex),OS 不會幫忙。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (21, 1, 23, 'choice', '(10%) Which of the following statements about synchronization are true?

(a) If the wait and signal operations are not executed atomically, then mutual exclusion may be violated.
(b) If the conditions of mutual exclusion, hold and wait, no preemption, and circular wait hold simultaneously in a system, then a deadline situation must arise.
(c) Spinlocks are not appropriate for uniprocessor systems.
(d) Semaphores and conditional critical regions are equivalent.
(e) None of the above are true.', '(b) 錯:四個條件是 deadlock 的必要條件而非充分條件(資源有多個 instance 時不一定 deadlock),且題目寫的是 deadline;(d) 兩者抽象層次不同,一般不視為等價。', 'AC');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (22, 1, 24, 'essay', '[10%] Why do Solaris, Linux, and Windows 2000 use spinlocks as a synchronization mechanism only on multiprocessor systems and not on single-processor systems?', '單處理器上,spinning 的 thread 佔住 CPU,持有鎖的 thread 無法執行來釋放鎖,spin 完全是浪費。多處理器上,持有者在其他 CPU 執行且通常很快釋放,短暫 spin 比 sleep/wakeup 的 context switch 成本低。因此單處理器上這些系統改用關閉 kernel preemption 或中斷的方式。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (23, 1, 25, 'essay', '1. What is a race condition? How to solve it? (4%)
2. What is the difference between deadlock prevention and deadlock avoidance? (4%)
3. When will you need to use a condition variable? (4%)
4. What is the difference between asynchronous and deferred cancellation of a target thread? (4%)
5. What are the four common conditions to cause process termination? (4%)', '1. 多個 process 同時存取並修改共享資料,結果取決於執行順序;用 mutex、semaphore 等同步機制保護 critical section 即可解決。
2. Prevention 靜態破壞 deadlock 必要條件之一;avoidance 執行時依資源需求資訊(Banker''s algorithm)確保系統維持 safe state。
3. Thread 需要等待某個條件成立(例如 buffer 非空)才能繼續時,可搭配 mutex 用 wait/signal,不必 busy waiting。
4. **Asynchronous**:立即終止目標 thread,可能留下不一致的資源。**Deferred**:目標 thread 定期檢查 cancellation point,在安全的位置自行結束。
5. Normal exit(正常結束)、error exit(主動錯誤結束)、fatal error(如非法存取,被 OS 終止)、被其他 process kill。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (24, 1, 26, 'essay', '[Synchronization and Deadlock: 20%]

1. Explain how the deadlock prevention scheme works. (8%)
2. Give three requirements for any solution to the critical-section problem. (6%)
3. What is the priority inversion problem? How to solve it? (4%)
4. What is conflict serializable for a non-serial schedule? (2%)', '1. 確保四個必要條件至少一個不成立:
   - mutual exclusion:資源可共享時不必互斥。
   - hold and wait:一次要求全部資源,或持有資源時不可再要求。
   - no preemption:要求不到時釋放已持有的資源。
   - circular wait:替資源編號,只能依遞增順序要求。
2. Mutual exclusion、progress、bounded waiting。
3. 高優先權 process 等待低優先權 process 持有的資源,而低優先權 process 被中優先權 process 搶占。解法是 priority inheritance:持有資源的低優先權 process 暫時繼承高優先權,直到釋放資源。
4. 若一個 non-serial schedule 可透過交換不衝突的相鄰操作,轉換成某個 serial schedule,就稱為 conflict serializable。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (25, 1, 27, 'choice', 'Choose the correct statements from the multiple choices.

(a) Data access is one of reasons for process migration.
(b) The standard UNIX pipe mechanism allows process migration.
(c) Modularity is one of reasons for process cooperation.
(d) Shared memory is one of models for interprocess communications among cooperating processes.
(e) None of the above.', '(b) 錯:標準 UNIX pipe 綁定在同一台機器的 kernel 上,不支援 process migration。', 'ACD');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (26, 1, 29, 'essay', '(10%) Describe the two fundamental models of inter-process communication.', '**Shared memory**:合作的 process 共享一塊記憶體區域,直接讀寫來交換資料。只有建立時需要 kernel,速度快,但需自行同步。
**Message passing**:process 透過 kernel 提供的 send/receive 交換訊息,不共享位址空間。適合少量資料與分散式系統,但每次都要 system call,較慢。可分為 direct/indirect、同步/非同步、不同的緩衝容量。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (27, 1, 30, 'choice', '(2%) A message-passing model is \_\_\_\_.

(a) easier to implement than a shared memory model for intercomputer communication
(b) faster than the shared memory model
(c) a network protocol, and does not apply to operating systems
(d) only useful for small simple operating systems', '電腦之間沒有共享的記憶體,message passing 比 shared memory 容易實作;但它通常較慢,且是 OS 的 IPC 機制。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (28, 1, 30, 'truefalse', '(1%) All access to POSIX shared memory requires a system call.', '只有建立與 mapping(shm_open、mmap)需要 system call;mapping 完成後就是一般的記憶體存取,不需 system call。', 'F');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (29, 1, 31, 'choice', 'Which of the following is correct about Direct Communication?

(a) processes must name each other explicitly
(b) Messages are exchanged via mailboxes
(c) Link established only if processes share a common mailbox
(d) Mailbox can be owned either by OS or processes', 'Direct communication 必須明確指名對方(send(P, msg)/receive(Q, msg));(b)(c)(d) 都是 indirect communication(mailbox)的特性。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (30, 1, 32, 'choice', 'Which of the following IPC mechanism is easier to implement in a distributed system?

(A) shared memory
(B) message passing
(C) socket communication
(D) ordinary pipe', '分散式系統中各電腦沒有共享記憶體,message passing 較容易實作。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (31, 2, 1, 'choice', '二、複選題,共十題,每題全對得 4 分,答錯一個選項得 2 分,答錯兩個以上選項、或未答得 0 分。

11. Which of the following statements are correct?

(a) Spinlocks are appropriate for uni-processor systems.
(b) The critical-section problem could be solved by disabling interrupts while accessing a shared variable in a uni-processor environment.
(c) Priority inheritance protocols can resolve race conditions in real time systems.
(d) A nonpreemptive kernel is free from race conditions on kernel data structures.
(e) The current Linux kernel is a nonpreemptive kernel and a process running in a kernel mode could not be preempted.', '(a) 單處理器上 spin 只會浪費 CPU;(c) priority inheritance 解決的是 priority inversion,不是 race condition;(e) Linux 自 2.6 起是 preemptive kernel。', 'BD');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (32, 2, 2, 'choice', '23. (4%) Which of the following statements are correct?

```text
 1 waiting[i]=1;
 2 key=1;
 3 while (waiting[i] && key) {
 4   key=test_and_set(lock);
 5 }
 6 waiting[i]=0;
 7 j=(i+1)%n;
 8 while ((j!=i) && (!waiting[j])) {
 9   j=(j+1)%n;
10 }
11 if (j==i) {
12   lock=0;
13 }
14 else {
15   waiting[j]=0;
16 }
```

(a) Line 1 can be removed without affecting the correctness of the program.
(b) Line 6 can be removed without affecting the correctness of the program.
(c) The program correctly implements a critical section because it satisfies the mutual-exclusion, progress, and bounded-waiting conditions.
(d) The program correctly implements a critical section using an array of semaphore to avoid busy waiting.
(e) None of the above are correct.', '這是 test_and_set 的 bounded-waiting 解法,三個條件都滿足。(a) 拿掉 line 1,`waiting[i]` 為 0 時迴圈直接跳過,不必取得 lock 就進入 CS,違反 mutual exclusion;(b) 拿掉 line 6,`waiting[i]` 一直為 1,之後別人離開時可能把進入權交給已不在等待的 Pi(`waiting[i]=0` 而不釋放 lock),其他人永遠等不到,違反 progress;(d) 沒有用 semaphore,仍是 busy waiting。', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (33, 2, 3, 'essay', 'We can implement a critical section in an OS kernel by using interrupt disabling-enabling mechanism. (16%)

(1) Prove or disprove the correctness of the following solution for an OS kernel to the critical-section problem. (10%)

```text
Acquire(lock) {
    disable_interrupt;
    while(lock.value != 0)
        ;
    lock.value = 1;
    enable_interrupt;
}
```

```text
Release(lock) {
    disable_interrupt;
    lock.value = 0;
    enable_interrupt;
}
```

(2) What are the necessities of using spin-lock in a multiprocessor platform? (6%)', '(1) **不正確**。若 lock 已被別的 process 持有,Acquire 會在**關中斷的狀態下**空轉:單處理器上 timer 中斷被關掉,持有 lock 的 process 永遠排不到 CPU 執行 Release,系統卡死(違反 progress)。修正方式是在迴圈內暫時開中斷再關中斷,例如 `while (lock.value != 0) { enable_interrupt; disable_interrupt; }`。

(2) 多處理器上關中斷只影響自己那顆 CPU,其他 CPU 仍可同時進入 critical section,所以必須用 test-and-set / CAS 等 atomic 指令實作的 spinlock。而且 kernel 的 critical section 通常很短,持有者在另一顆 CPU 上很快就會釋放,spin 一下比 context switch(sleep/wakeup)更省成本。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (34, 2, 4, 'essay', '五、Will all the requirements of the solution to the critical-section problem be satisfied for the following program? Please provide a brief discussion. (4%)

```text
/* lock is a shared data and initialized to 0 */
while (1) {
    key = 1;
    while (key) {
        swap(lock, key); /* swap() is the atomic swap instruction */
    }
    ... the critical section part...
    lock = 0;
    ... the remaining part ...
}
```', '- **Mutual exclusion:滿足**。只有把 `lock` 從 0 換成 1 的那個 process(拿到 key = 0)能進入,swap 是 atomic 的。
- **Progress:滿足**。lock 為 0 時,第一個執行 swap 的 process 就能進入,不會因為不想進入的 process 而被擋住。
- **Bounded waiting:不滿足**。lock 釋放時由誰搶到完全看時機,剛離開的 process 可能一直重新搶到 lock,其他 process 可能 starvation。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (35, 2, 5, 'choice', 'Consider the following structure of two processes Pᵢ, i=0 or 1, where assignment and evaluation on shared flag[] are atomic operations.

```text
void * Process(int i) {
    int j;
    do {
        if(i==0)
            j=1;
        else
            j=0;
        flag[i] = true;
        while(flag[j]);
        critical section;
        flag[i] = false;
        remainder section;
    } while(true);
}
```

Which of the following about the critical section problem are correct?

(A) Process 0 and Process 1 always perform alternatively.
(B) Mutual exclusion requirement can be satisfied.
(C) Progress requirement can be satisfied.
(D) Bounded waiting requirement can be satisfied.
(E) Forever looping may occur.', '(B) 進入前先舉 flag 再檢查對方,兩者不可能同時通過。(C)(E) 若兩者先後執行 `flag[i]=true` 再檢查,會互相等待永遠迴圈(deadlock),progress 不滿足。(D) Pj 舉 flag 後,Pi 離開再回來時會看到 `flag[j]` 而停住,Pj 最多等 Pi 一次,bounded waiting 滿足。(A) 單一 process 可連續進入,不一定輪流。⚠ 部分解答認為 (D) 不成立。', 'BDE');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (36, 2, 6, 'essay', 'If a solution to the critical section problem is correct, it must satisfy three necessary requirements. Show that at least one of the necessary requirements is not satisfied by the following solution. (10%)

```text
boolean choosing[n];
int number[n];
do {
    choosing[i]=true;
    number[i]=max(number[0], number[1], ..., number[n-1])+1;
    choosing[i]=false;
    for(j=0; j<n; j++)
        while((number[j]!=0)&&(number[j,j]<number[i,i]));
    critical section
    number[i]=0;
    remainder section
} while(1);
```', '這是少了 `while (choosing[j]);` 的 Bakery algorithm,**mutual exclusion 不滿足**。

(`number[j,j]<number[i,i]` 指的是 (number[j], j) < (number[i], i)。)

反例(i < j):
1. Pi 與 Pj 同時計算 max,都算出相同的號碼 k,但兩人都還沒寫回。
2. Pj 先寫入 `number[j]=k`,檢查 Pi 時看到 `number[i]==0`,直接進入 critical section。
3. Pi 接著寫入 `number[i]=k`,檢查 Pj 時比較:(k, j) < (k, i) 不成立(因為 i < j),Pi 不必等待,也進入 critical section。

兩者同時在 CS 中。`choosing[j]` 的作用就是等待對方「取號完成」,避免讀到尚未寫入的號碼。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (37, 2, 7, 'essay', 'The critical section problem of two processes is solved as follows: (15%)

Algorithm 1

```text
repeat
    while turn ≠ i do no-op;
    critical section;
    turn: = j;
    remainder section;
until false;
```

Algorithm 2

```text
repeat
    flag[i]: = true;
    while flag[j] do no-op;
    critical section;
    flag[i]: = false;
    remainder section;
until false;
```

Algorithm 3

```text
repeat
    flag[i]: = true;
    turn: = j;
    while (flag[j] and turn = j) do no-op;
    critical section;
    flag[i]: = false;
    remainder section;
until false;
```

Are the conditions mutual exclusion, progress, and bounded waiting satisfied? You must give detailed explanation.', '| | Mutual exclusion | Progress | Bounded waiting |
|---|---|---|---|
| Algorithm 1 | ✓ | ✗ | ✓ |
| Algorithm 2 | ✓ | ✗ | ✓ |
| Algorithm 3 | ✓ | ✓ | ✓ |

- **Algorithm 1(strict alternation)**:`turn` 只有一個值,同時只有一人能進入。但必須嚴格輪流,若 Pj 在 remainder section 不想進入,Pi 也無法再次進入,progress 不滿足。輪流進入所以最多等一次。
- **Algorithm 2**:先舉 flag 再檢查對方,不會同時進入。但兩者都舉起 flag 後會互相等待(deadlock),progress 不滿足。
- **Algorithm 3(Peterson''s solution)**:兩者都想進入時由 `turn` 決定,最後設定 turn 的那方讓步,所以不會同時進入,也不會互相等待。Pi 離開後若再進入會把 turn 設成 j,讓 Pj 先進入,最多等一次。三個條件都滿足。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (38, 2, 8, 'essay', 'The following program segment can be used to provide mutual exclusion that satisfies the bounded-waiting requirement. Please write the missing instructions in A and B. (10%)

```text
boolean waiting[n] = {FALSE};
boolean lock = FALSE;

do {
    waiting[i] = TRUE;
    key = TRUE;
    while (waiting[i] && key)
        swap (&lock, &key);

    A;

    /* critical section */
    j = (i+1) % n;
    while ((j != i) && !waiting[j])
        j = (j+1) % n;

    if (j == i)
        lock = FALSE;
    else
        B;
    /* remainder section */
} while (TRUE);

void Swap (boolean *a, boolean *b) {
    boolean temp = *a;
    *a = *b;
    *b = temp;
}
```', '- **A**:`waiting[i] = FALSE;` 進入 CS 後表示自己不再等待。
- **B**:`waiting[j] = FALSE;` 不釋放 lock,而是直接把進入權交給下一個等待中的 Pj,讓 Pj 跳出 while 迴圈。依 (i+1)…(i+n−1) 的順序尋找,因此任何等待者最多等 n−1 輪。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (39, 2, 9, 'essay', '第三題[12%]

The first known correct software solution to the critical-section problem for two processes was developed by Dekker. The two processes, P₀ and P₁, share the following variables:

```text
boolean flag[2];   /*initially FALSE*/
int turn;          /*initially 0 or 1*/
```

The structure of process Pᵢ in Dekker''s algorithm:

Note: Pᵢ (i == 0 or 1), the other process is Pⱼ (j == 1 or 0)

```text
do {
    flag[i] = TRUE;
    while(flag[j]) {
        if(turn == j) {    // part (b): this line removed
            flag[i] = FALSE;
            while(turn == j)
                ; // do nothing
            flag[i] = TRUE;
        }                 // part (b): this line removed
    }
    // critical section

    turn = j;
    flag[i] = FALSE;

    // remainder section
} while(TRUE);
```

(a) Prove that the algorithm satisfies all three requirements (mutual exclusion, progress, bounded waiting) for the critical-section problem.
(b) If we removed the checking `if(turn == j)`, then what requirement(s) will not be satisfied?', '(a)
- **Mutual exclusion**:Pi 只有在 `flag[i]==TRUE` 且看到 `flag[j]==FALSE` 時才進入。若兩者同時在 CS 中,後進入的那方在設定自己的 flag 之後,一定會看到對方的 flag 為 TRUE,矛盾。
- **Progress**:只有一方想進入時,對方 flag 為 FALSE,可直接進入。兩方都想進入時,`turn` 指向的那方(被禮讓者)不會放下 flag,另一方放下 flag 等待,所以被禮讓者一定能進入,不會互相等待。
- **Bounded waiting**:Pi 離開時把 `turn` 設為 j。若 Pj 正在等待,Pi 再回來時會因 `turn==j` 而放下 flag 等待,Pj 必定能先進入。所以 Pj 最多等 Pi 進入一次。

(b) 拿掉 `if (turn == j)` 後,兩個 process 只要看到對方的 flag 就都會放下自己的 flag 退讓,不再由 `turn` 決定誰優先。mutual exclusion 仍成立,但兩者可能不斷「同時舉起、同時放下」,形成 livelock,**progress(以及 bounded waiting)無法保證**。⚠ 此小題各家解答略有不同。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (40, 2, 9, 'choice', 'Which description is wrong? (2 pt)

(1) If using semaphore as the synchronization mechanism, we do not allow context switch during a critical section. In other words, we do not allow context switch between wait(S) and signal(S), where S is a semaphore.
(2) Usually, each process has an associated page table. In contrast, only one inverted page table is in the system.
(3) The local variables are created in the stack segment while the global variables are in data segment.
(4) Read ahead and free behind are useful for sequential accesses.', 'Semaphore 保證的是 mutual exclusion,process 在 wait(S) 與 signal(S) 之間仍可能被 context switch,只是其他 process 進不了同一個 critical section。', '1');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (41, 2, 10, 'choice', 'Please choose the criteria in solving the critical section problem in the synchronization of multi-threaded programs from below.

(a) Bounded waiting
(b) Turn-around time
(c) Mutual exclusion
(d) Progressiveness
(e) Communication security', 'Critical-section 解法的三個條件:mutual exclusion、progress、bounded waiting。Turn-around time 是排班的評估標準。', 'ACD');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (42, 2, 11, 'choice', '單一選擇題 每一題答對給 4 分,未答得 0 分,答錯倒扣 1.5 分

Which of the following statements is incorrect?

(a) The "TestAndSet()" instruction used for process synchronization must have hardware support so that the Test and Set operations can be done atomically.
(b) The "TestAndSet()" instruction can be used to implement a lock.
(c) An atomic "Swap()" instruction can be used to replace the "TestAndSet()" instruction.
(d) A mutex lock is a special semaphore whose value ranges only between 0 and 1.
(e) A mutex lock is used to protect a critical section of code. It cannot protect a shared variable.', 'Mutex lock 保護 critical section,而 critical section 正是存取共享變數的程式碼,所以它就是用來保護共享變數的。', 'E');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (43, 2, 12, 'choice', 'Which of the following statements is incorrect?

(a) A spinlock is a lock that will cause a requesting process to busy-wait to get it when it is in the locked state.
(b) Using spinlocks will not cause deadlock on a multi-processor system.
(c) A spinlock should not be used on a uni-processor system.
(d) Compared with a non-spinlock, a spinlock allows a requesting process to get the lock more quickly because the process need not do a context switch.
(e) For a non-spinlock, its wait() and signal() operations must be executed atomically.', 'Spinlock 一樣可能 deadlock,例如兩個 thread 以相反順序取得兩把 spinlock,就會互相空轉等待。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (44, 2, 13, 'choice', 'Which of the following statements is incorrect?

(a) Race condition refers to the situation where several processes access and manipulate same data concurrently and the outcome of the execution depends on the particular order in which the access takes place.
(b) The critical-section problem is to make sure that no two processes are executing in their critical sections at the same time.
(c) Preemptive kernel design cannot prevent the critical-section problem from occurring in the kernel.
(d) The "bounded waiting" requirement means that when a process wants to enter its critical section, it can only make a limited number of requests.
(e) The race condition problem can occur in a multi-threaded user-level process.', 'Bounded waiting 是指:process 提出請求後,**其他 process** 搶先進入 critical section 的次數有上限,而不是限制自己的請求次數。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (45, 2, 14, 'choice', 'Which of the following statements are correct?

(a) Deadlock condition refers to the situation where several processes are currently blocked waiting for some resources to be released by some of them.
(b) The "hold and wait" and "circular wait" requirement conditions are redundant and thus one of them can be removed.
(c) Preemptive kernel design cannot prevent the deadlock problem with kernel data structures from occurring in the kernel.
(d) For the banker''s algorithm to work correctly, when a new process enters the system, it must declare the maximum number of instances of each resource type that it may need; otherwise, this algorithm will fail.
(e) Currently, the Unix kernel implements a method to avoid deadlock problems with kernel data structures from occurring in the kernel.', '(b) 四個必要條件各自獨立,不能拿掉任何一個;(e) Unix/Linux 一般忽略 deadlock(由程式設計者負責),沒有實作 avoidance。⚠ (a) 的描述較寬鬆,部分解答不選。', 'ACD');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (46, 2, 15, 'essay', 'The following algorithm is proposed for trying to solve the critical-section problem for only 2 processes, P0 and P1. Shared variables flag[2] of Boolean data type are initially set to false; i.e., flag[0]=flag[1]=false. If variable flag[i] is set to true, then process Pi is ready to enter its critical section. The algorithm for Process Pi is as follows: (where i=0 or 1, and j = (i+1) %2)

```text
do {
    flag[i] = true;
    while (flag[j]);
        critical section
    flag[i] = false;
        remainder section
}while(1);
```

Does the above algorithm satisfy all three requirements (mutual exclusion, progress, bounded waiting)? Justify your answer. (12%)', '**不滿足全部條件。**
- **Mutual exclusion:滿足**。進入前先舉 flag 再檢查對方的 flag,兩者不可能同時通過 while。
- **Progress:不滿足**。P0 執行 `flag[0]=true` 後被切換,P1 執行 `flag[1]=true`,兩者都卡在 while 迴圈互相等待(deadlock),沒有人能進入。
- **Bounded waiting:滿足**。Pj 舉起 flag 後,Pi 離開再回來時會被 `flag[j]` 擋住,Pj 最多等 Pi 一次。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (47, 2, 16, 'choice', '4. Peterson''s solution is a software-based solution to the critical-section problem. For two processes accessing a shared variable, Peterson''s solution provides: (5%, 多選)

(a) Hold and wait
(b) Progress
(c) Mutual exclusion
(d) Circular wait
(e) None of the above', 'Peterson''s solution 滿足 mutual exclusion、progress、bounded waiting。Hold and wait、circular wait 是 deadlock 的必要條件。', 'BC');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (48, 2, 17, 'choice', 'What locking mechanism is better suited for multiprocessor where threads run for a short period of time?

(A) spinlocks
(B) mutexes
(C) semaphores
(D) adaptive mutexes
(E) condition variables.', '多處理器上鎖持有時間很短時,spin 一下的成本比 context switch 小,適合用 spinlock。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (49, 2, 18, 'choice', 'What is the most required hardware support for the synchronization implementation in an operating system?

(A) data cache
(B) instruction cache
(C) translation look-ahead buffers
(D) atomic read-modify-write cycle
(E) superscalar architecture', '同步機制(test-and-set、swap、CAS)都需要硬體提供不可分割的 read-modify-write 操作。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (50, 2, 19, 'choice', 'Signals are an inter-process communication mechanism in Unix/Linux OS. Signals can be generated by

(A) a user shell command
(B) programs via system calls
(C) the kernel
(D) an interrupt or exception handler.', 'Signal 可以由 shell 指令(`kill`、Ctrl-C)、程式呼叫 `kill()` system call、kernel(例如 SIGCHLD),以及例外處理(除以零產生 SIGFPE、非法存取產生 SIGSEGV)產生。', 'ABCD');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (51, 2, 20, 'choice', 'In UNIX/Linux, inter-process communication (IPC) mechanisms includes

(A) Shared memory segments
(B) Semaphores
(C) Message queues
(D) Signals
(E) Pipes.', '五個都是 UNIX/Linux 提供的 IPC 機制(System V IPC 包含 shared memory、semaphore、message queue,另有 signal 與 pipe)。', 'ABCDE');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (52, 2, 21, 'essay', 'A solution to the critical-section problem must satisfy the three requirements: mutual exclusion, progress, and bounded waiting. The program segment in Fig. OS_2 is designed with the hardware instruction, swap( ), and is tried to solve the critical-section problem.

```text
do {
    key = TRUE;
    while (lock == TRUE)
        swap(&key, &lock);
    // critical section
    lock = FALSE;
    // remainder section
} while (TRUE);
```

Fig. OS_2

(a) Can the requirement "mutual exclusion" be satisfied? If not, what is the bug that must be fixed? (5%)

(b) Suppose that "mutual exclusion" is satisfied either by fixing some bugs or by no need. Can the requirements, "progress" and "bounded waiting" be satisfied? (5%)', '(a) **不滿足**。lock 為 FALSE 時,迴圈條件不成立,process 根本沒執行 swap 就進入 CS,lock 仍是 FALSE,其他 process 也能直接進入。另外,檢查 `lock` 與執行 swap 之間也不是 atomic 的。修正:改成以 key 為迴圈條件,`while (key == TRUE) swap(&lock, &key);`,只有把 lock 從 FALSE 換成 TRUE 的人能進入。

(b) 修正後 **progress 滿足**(lock 為 FALSE 時第一個 swap 的人就能進入),**bounded waiting 不滿足**(lock 釋放後誰搶到看時機,可能有 process 一直搶不到)。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (53, 2, 22, 'essay', '(10 分) 某位學生仿效 Peterson 的方法來解決 critical section (關鍵區域)問題的時候,作了一些修改,如下圖所示。(a) 請問 critical section 問題有哪些需求? (b) 這個程式是正確解答嗎? (c) 請用程式運轉的實例來說明前項答案

```text
Process P_i   // i is 0 or 1 and   j = 1 - i

do {
    turn = j;
    flag[i] = TRUE;
    while (flag[i] && turn == j);
        Critical Section
    flag[i] = FALSE;
        Remainder Section
} while (TRUE)
```', '(a) Mutual exclusion、progress、bounded waiting。

(b) **不正確**。while 檢查的是自己的 `flag[i]`(一定是 TRUE),所以條件等於 `turn == j`:Pi 必須等 Pj 把 turn 改成 i 才能進入。mutual exclusion 雖然成立,但 **progress 不滿足**。

(c) 只有 P0 想進入:P0 設 `turn=1`、`flag[0]=TRUE`,接著在 `while (turn == 1)` 空轉。P1 一直在 remainder section,不會去改 turn,P0 永遠進不了 critical section。正確的 Peterson 應該先 `flag[i]=TRUE; turn=j;`,並檢查 `while (flag[j] && turn == j)`。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (54, 2, 23, 'essay', '(5%) (b) The producer-consumer problem (or bounded buffer problem) in the following code has fatal race condition, please explain how this condition happens?

Code for producer process

```text
while (true) {
    /* produce an item in nextProduced */
    while (counter == BUFFER_SIZE)
        ; /* do nothing */
    buffer[in] = nextProduced;
    in = (in + 1) % BUFFER_SIZE;
    counter++;
}
```

Code for consumer process

```text
while (true) {
    while (counter == 0)
        ; /* do nothing */
    nextConsumed = buffer[out];
    put = (out + 1) % BUFFER_SIZE;
    counter--;
    /* consumer the item in nextConsumed */
}
```

(6%) (c) Please use semaphores to solve the problem (b) so that the fatal race condition cannot occur.

(5%) (d) Why we have to guard against race condition and synchronize the critical section?', '(b) `counter++` 與 `counter--` 在機器層級是 `load → 運算 → store` 三個步驟。例如 counter = 5:producer 讀到 5 → 被切換 → consumer 讀到 5、寫回 4 → producer 寫回 6。結果應為 5,卻變成 6(或 4),之後 buffer 狀態錯亂(覆蓋未消耗的資料或讀到空的格子)。(另外 consumer 的 `put` 應為 `out`。)

(c)
```text
semaphore mutex = 1, empty = BUFFER_SIZE, full = 0;

Producer:                       Consumer:
while (true) {                  while (true) {
    produce nextProduced;           wait(full);
    wait(empty);                    wait(mutex);
    wait(mutex);                    nextConsumed = buffer[out];
    buffer[in] = nextProduced;      out = (out + 1) % BUFFER_SIZE;
    in = (in + 1) % BUFFER_SIZE;    signal(mutex);
    signal(mutex);                  signal(empty);
    signal(full);                   consume nextConsumed;
}                               }
```
用 `empty`/`full` 計數取代 counter,`mutex` 保護 buffer 的存取。

(d) 共享資料被同時修改時,結果取決於不可預期的執行順序,會產生錯誤且難以重現的結果(資料不一致)。同步 critical section 才能確保資料的一致性與程式結果的正確性。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (55, 2, 24, 'essay', '(15 pt) The critical-section problem is to design a protocol that the processes can use to cooperate. Please answer following questions.

(1) (5 pt) What are the requirements that a correct solution to the critical-section problem must satisfy?

(2) (10 pt) Design a correct software solution to the critical-section problem for two processes. Present a justification of the algorithm''s correctness.', '(1) **Mutual exclusion**:同一時間最多一個 process 在 critical section 中。**Progress**:沒有人在 CS 時,只有想進入的 process 參與決定誰進入,且決定不能無限延遲。**Bounded waiting**:process 提出請求後,其他 process 搶先進入的次數有上限。

(2) Peterson''s solution:
```text
boolean flag[2] = {false, false};
int turn;

Pi:  do {
         flag[i] = true;
         turn = j;
         while (flag[j] && turn == j);
         /* critical section */
         flag[i] = false;
         /* remainder section */
     } while (true);
```
- **ME**:若兩者同時在 CS,則 `flag[0]` 與 `flag[1]` 都為 true,而 turn 只能是 0 或 1,必有一方卡在 while,矛盾。
- **Progress**:Pj 不想進入時 `flag[j]=false`,Pi 直接進入;兩者都想進入時由 turn 決定,不會互相等待。
- **Bounded waiting**:Pi 離開後若再要進入,會設 `turn=j` 讓 Pj 先進入,所以 Pj 最多等一次。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (56, 2, 25, 'choice', 'Dekker 的 mutual exclusion 演算法,是目前已知,第一個能夠對兩個 thread 解決 critical section 問題的演算法。這個演算法,對 process Pk,k∈{0,1},其 pseudo-code 如下。

```c
Pk:
    flag[k] = true;
    while (CONDITION_X) {
        if (turn ≠ k) {
            flag[k] = false;
            while (turn ≠ k) {
                // busy wait
            }
            flag[k] = true;
        }
    }

    // critical section
    ...
    turn = 1-k;
    flag[k] = false;
    // remainder section
```

請問關於這演算法,下列敘述何者為真?

(A) CONDITION_X 應該是 flag[1-k] == true
(B) CONDITION_X 應該是 flag[1-k] == false
(C) 這個演算法要能正確執行,flag[0] 與 flag[1] 的 initial values 其中一個必須是 false。
(D) 這個早期的演算法,並不保證 starvation-freedom,也就是不保證 bounded waiting。
(E) 若啟動 compiler 的 out-of-order execution optimization,則此演算法產生的機器碼,不再保證 critical section 的 mutual exclusion。', '(A) 對方也想進入時才需要協調。(C) 兩個 flag 的初始值都必須是 false(表示一開始沒人想進入)。(D) Dekker 演算法保證 bounded waiting。(E) 編譯器或 CPU 重排讀寫順序後,「先舉 flag 再檢查對方」的假設不再成立,需要 memory barrier。', 'AE');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (57, 2, 26, 'choice', '[2%] For two processes accessing a shared variable, Peterson''s algorithm must satisfy:

(1) semaphores
(2) mutual exclusion
(3) synchronization
(4) progress
(5) bounded-waiting', 'Peterson''s algorithm 是純軟體解法,不使用 semaphore,滿足 critical-section 問題的三個條件。', '245');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (58, 2, 27, 'essay', 'Suppose we have n processes, P₀ ~ Pₙ₋₁. The common data structures are:

```c
boolean waiting[n];
boolean lock;
```

The global variable lock is initialized to false. All the waiting[i] are initialized to false.

The following is the structure for process Pi:

```c
do {
    waiting[i] = true;
    key = true;
    while(waiting[i] && key)
        key = test_and_set(&lock);
    waiting[i] = false;
    /*critical section*/
    j = (i+1)%n;
    while ((j!=i) && !waiting[j])
        j = (j+1)%n;

    if (j==i)
        lock = false;
    else
        waiting[j] = false;

    /* remainder section*/
}while(true);
```

Does the above algorithm satisfy all three requirements (mutual exclusion, progress, bounded waiting)? Justify your answer.', '**三個條件都滿足。**
- **Mutual exclusion**:Pi 只有在 `key == false`(第一個把 lock 設成 true 的人)或 `waiting[i] == false`(被前一個離開的人指定)時才能進入。離開時要嘛釋放 lock,要嘛把進入權交給一個人,所以同時只有一人在 CS。
- **Progress**:離開的 process 不是釋放 lock 就是讓某個等待者進入,只要有人在等,一定有人能進入。
- **Bounded waiting**:離開時依 i+1, i+2, …, i−1 的循環順序找下一個等待者,任何等待中的 process 最多等 n−1 次就會輪到。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (59, 2, 28, 'essay', '(8 pt) Consider a CPU that supports the "TestAndSet" instruction. An engineer uses the instruction to solve the critical section problem, and his solution is shown below. A correct solution must satisfy three conditions, i.e., mutual exclusion, progress, and bounded waiting. Please prove or disprove the correctness of his solution.

```c
while (TRUE) {
    while (TestAndSet (&lock))
        ;   // do nothing

    // critical section

    lock = FALSE;

    // remainder section
}
```', '**不是完全正確的解法。**
- **Mutual exclusion:滿足**。TestAndSet 是 atomic 的,只有把 lock 從 FALSE 變成 TRUE 的那個 process(回傳 FALSE)能進入。
- **Progress:滿足**。lock 為 FALSE 時,第一個執行 TestAndSet 的 process 一定能進入。
- **Bounded waiting:不滿足**。lock 釋放後由誰搶到不確定,例如 P0 離開後馬上又搶到 lock,P1 可能一直搶不到而 starvation。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (60, 2, 29, 'essay', 'a. (4%) What are three requirements for a solution to the critical-section problem?

b. (6%) Consider the following solution to the critical-section problem involving two processes P₀ and P₁. Assume that the variable turn is initialized to 0. Process P₀''s code is presented below.

```c
/* Other code*/

While (turn != 0){} /* Do nothing and wait. */
Critical Section /* ... */
turn=0;

/*Other code*/
```

For process P₁, replace 0 by 1 in above code. Determine if the solution meets all the required conditions for a correct critical-section problem solution.', 'a. Mutual exclusion、progress、bounded waiting。

b. **不符合。** 依題意 P₀ 離開時 `turn=0`,P₁ 離開時 `turn=1`,turn 永遠不會交給對方。turn 初始為 0,所以只有 P₀ 能進入,P₁ 永遠在等待。
- Mutual exclusion:滿足(turn 同時只有一個值)。
- Progress:不滿足(CS 空著時,P₁ 想進入也進不去)。
- Bounded waiting:不滿足(P₁ 無限等待)。

就算改成離開時把 turn 交給對方(strict alternation),也必須嚴格輪流,progress 仍不滿足。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (61, 2, 30, 'essay', '(10 分) Please answer following question about synchronization:

(a) What is a critical-section? (4 分)

(b) What is busy waiting? (2 分) What is the advantage and disadvantage of busy waiting? (4 分)', '(a) Process 中存取共享資料(變數、檔案、table 等)的程式片段。同一時間只能有一個 process 在自己的 critical section 中執行,否則可能產生 race condition。

(b) **Busy waiting**:process 等待某個條件成立時,在迴圈中不斷檢查,佔著 CPU 空轉(例如 spinlock)。
- 優點:不需要 context switch,等待時間很短時(多處理器、鎖持有時間短)反應快、成本低。
- 缺點:浪費 CPU 時間;在單處理器上,持有者可能因此無法執行,等待時間更久。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (62, 2, 31, 'choice', 'A race condition \_\_\_\_.

(A) results when several threads try to access the same data concurrently
(B) results when several threads try to access and modify the same data concurrently
(C) will result only if the outcome of execution does not depend on the order in which instructions are executed
(D) None of the above', '必須有修改(寫入)且結果取決於執行順序才是 race condition,只有讀取不會。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (63, 2, 32, 'choice', 'A counting semaphore \_\_\_\_.

(A) is essentially an integer variable
(B) is accessed through only one standard operation
(C) can be modified simultaneously by multiple threads
(D) cannot be used to control access to a thread''s critical sections', 'Semaphore 本質上是一個整數,只能透過 wait() 與 signal() 兩個 atomic 操作存取,不能被同時修改,也可以用來控制 critical section。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (64, 2, 33, 'choice', 'A \_\_\_ type presents a set of programmer-defined operations that are provided mutual exclusion within it.

(A) transaction
(B) signal
(C) binary
(D) monitor', 'Monitor 是一種抽象資料型別,裡面的操作同一時間只有一個 process 能執行。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (65, 2, 34, 'choice', 'A solution to the critical section problem does not have to satisfy which of the following requirements?

(A) mutual exclusion
(B) progress
(C) atomicity
(D) bounded waiting', '三個條件是 mutual exclusion、progress、bounded waiting,atomicity 不在其中。', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (66, 2, 35, 'choice', 'How many philosophers may eat simultaneously in the Dining Philosophers problem with 5 philosophers?

(A) 1
(B) 2
(C) 3
(D) 5', '5 根筷子,每人需要 2 根,最多 ⌊5/2⌋ = 2 人同時用餐。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (67, 2, 36, 'choice', 'When using semaphores, a process invokes the wait() operation before accessing its critical section, followed by the signal() operation upon completion of its critical section. Consider reversing the order of these two operations—first calling signal(), then calling wait(). What would be a possible outcome of this?

(A) Starvation is possible.
(B) Deadlock is possible.
(C) Mutual exclusion is still assured.
(D) Several processes could be active in their critical sections at the same time.', '先 signal() 會讓 semaphore 的值增加,其他 process 不會被擋住,可能多個 process 同時在 critical section 中,mutual exclusion 被破壞。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (68, 2, 37, 'choice', 'Another problem related to deadlocks is \_\_\_\_.

(A) race conditions
(B) critical sections
(C) spinlocks
(D) indefinite blocking', 'Indefinite blocking(starvation):process 在 semaphore 的 waiting queue 中可能永遠等不到,例如 LIFO 的 queue。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (69, 2, 38, 'choice', 'Which one(s) of the following statements adequately describe the test-and-set instruction for process synchronization?

(a) It does not work in multi-processor environments.
(b) It can all be implemented in the user space, provided that the lock variable is in a shared memory region.
(c) It does not waste any CPU cycles when a process cannot acquire a lock.
(d) The CPU must guarantee that the test-and-set instruction is an atomic operation.', '(a) 多處理器上也能使用(硬體會鎖住 memory bus/cache line);(b) test-and-set 是一般指令,不需要 system call,user space 就能用;(c) 拿不到 lock 時會 busy waiting,浪費 CPU;(d) 必須是 atomic。', 'BD');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (70, 2, 39, 'essay', '(4%) Please explain the concept of transaction atomicity.', 'Transaction 是執行單一邏輯功能的一組操作(例如轉帳的「扣款+入帳」)。Atomicity 是指 transaction 要嘛全部完成(commit),要嘛完全沒有發生(abort 並 rollback 回原狀),不會停留在只做了一半的狀態。通常用 write-ahead log 或 checkpoint 實作,即使系統當機也能回復。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (71, 2, 40, 'essay', '(10%) What is a "critical section" in concurrent programming? How to implement critical section(s) in two threads?', 'Critical section 是存取共享資源的程式片段,同一時間只能有一個 thread 執行,否則會產生 race condition。

兩個 thread 的實作方式:
- **軟體**:Peterson''s solution(`flag[2]` + `turn`)。
- **硬體指令**:用 test-and-set、swap、CAS 實作 spinlock。
- **OS / 函式庫提供的同步工具**:mutex lock(`pthread_mutex_lock` / `unlock`)、semaphore(`wait` / `signal`)、monitor。

例如:
```c
pthread_mutex_lock(&m);
/* critical section */
pthread_mutex_unlock(&m);
```', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (72, 2, 41, 'choice', '(2%) 關於 Peterson solution for critical section 的敘述哪一項是錯誤的?

(a) 無需 OS 的支援
(b) 無需硬體支援
(c) 限定在兩個行程
(d) 沒有 busy waiting', 'Peterson solution 在 while 迴圈中空轉等待,屬於 busy waiting。', 'D');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (73, 2, 42, 'choice', 'A solution to the critical section problem does not have to satisfy which of the following requirements?

(A) mutual exclusion
(B) progress
(C) atomicity
(D) bounded waiting
(E) All of the above', '三個條件是 mutual exclusion、progress、bounded waiting,atomicity 不在其中。', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (74, 2, 43, 'truefalse', '[2 points] Modularity is one of the reasons to support process cooperation.', 'Process cooperation 的理由:information sharing、computation speedup、modularity、convenience。', 'T');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (75, 2, 44, 'choice', '**第 1 小題**(5 points) The following is the critical section solution by Leslie Lamport in 1974.

```text
(1)  do {
(2)      choosing[i]=true;
(3)      number[i]=max(number[0], ...,number[n-1]);
(4)      choosing[i]=false;
(5)      for (j=0; j < n; j++) {
(6)          while choosing[j];
(7)          while (number[j] != 0 && (number[j],j)≤(number[i],i));
(8)      }
(9)      critical section
(10)     number[i]=0;
(11)     remainder section
(12) } while (1);
```

The parenthesized numbers on the left are the line numbers. Please answer which of the following statements is/are correct!

(a) Line (3) is incorrect!
(b) Line (7) is incorrect!
(c) Line (10) is incorrect!', '(a) 應為 `max(...) + 1`,否則號碼不會遞增,大家可能都拿到 0。(b) 應為 `<`:用 `≤` 時 j == i 那一輪的條件 (number[i],i) ≤ (number[i],i) 恆成立,process 會等自己而永遠卡住。(c) 離開時把號碼歸零是正確的。', 'AB');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (76, 2, 44, 'choice', '**第 2 小題**(5 points) Continuing from the last question, for the correct version of Lamport''s Bakery algorithm, please answer which of the following statements is/are correct?

```text
(1)  do {
(2)      choosing[i]=true;
(3)      number[i]=max(number[0], ...,number[n-1]);
(4)      choosing[i]=false;
(5)      for (j=0; j < n; j++) {
(6)          while choosing[j];
(7)          while (number[j] != 0 && (number[j],j)≤(number[i],i));
(8)      }
(9)      critical section
(10)     number[i]=0;
(11)     remainder section
(12) } while (1);
```

(a) The solution relies on OS or hardware support for the max operation in line (3).
(b) The solution is incorrect for distributed implementation across internet.
(c) The entry section complexity is O(3n+2) queries to peer processes.', '(a) Bakery algorithm 不需要 atomic 的 max,兩人拿到相同號碼時以 process id 決定順序;(b) 每個 process 只寫自己的變數、讀別人的變數,適合分散式實作;(c) 取號讀 n 個 number,迴圈中每個 j 讀 choosing[j] 與 number[j] 共 2n 次,加上 2 次寫入 choosing。⚠ 本小題各家解答分歧,請再確認。', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (77, 2, 45, 'choice', '(10) Which of the following is true for the solutions to critical-section problems?

(A) No deadlock implies progress, and progress implies bounded waiting
(B) Bounded waiting implies progress, and progress implies no deadlock
(C) Progress implies no deadlock, and no deadlock implies bounded waiting
(D) Bounded waiting implies no deadlock, and no deadlock implies progress', '條件由強到弱:bounded waiting ⇒ progress ⇒ no deadlock。反過來不成立,例如沒有 deadlock 不代表不會 starvation。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (78, 2, 46, 'essay', '**版本一**:Please show and explain the critical-section problem first and then explain the requirements of mutual exclusion, progress, and bounded waiting. (10%)

**版本二**:(10%) (a) What is a critical section? (b) What are the requirements that the solution of critical section problem must satisfy?', '**Critical-section problem**:每個 process 都有一段存取共享資料的程式碼(critical section)。問題在於設計一個協定(entry section / exit section),使同一時間只有一個 process 在 critical section 中執行。

```text
do {
    entry section
        critical section
    exit section
        remainder section
} while (true);
```

三個需求:
- **Mutual exclusion**:某個 process 在 critical section 中執行時,其他 process 不能進入自己的 critical section。
- **Progress**:沒有人在 critical section,且有 process 想進入時,只有不在 remainder section 的 process 能參與決定下一個進入者,且這個決定不能無限延遲。
- **Bounded waiting**:process 提出進入請求後,其他 process 搶先進入的次數有上限,不會無限等待(starvation)。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (79, 2, 47, 'choice', '\_\_\_\_ is/are not a technique/s for handling critical sections in operating systems.

(a) Nonpreemptive kernels
(b) Preemptive kernels
(c) Spinlocks
(d) Peterson''s solution
(e) Dekker''s algorithm', 'OS 處理 critical section 的兩種方式是 preemptive kernel 與 nonpreemptive kernel,實作上使用 spinlock 等硬體同步。Peterson''s 與 Dekker''s 是純軟體演算法,在現代架構(指令重排)上不保證正確,OS 不會使用。⚠ 本題解答有分歧,請再確認。', 'DE');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (80, 2, 48, 'choice', 'When the exclusive lock is applied to a file then \_\_\_\_

(A) only one process can use this file
(B) only one process can write to this file, but many processes can read it concurrently
(C) many processes can read and write to this file concurrently
(D) processes can write to this file only', 'Exclusive lock 類似 writer lock,同一時間只有一個 process 能取得並使用檔案。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (81, 2, 48, 'choice', 'When the shared lock is applied to a file then \_\_\_\_

(A) several processes can acquire the lock concurrently
(B) only one process can use this file
(C) many processes can read and write to this file concurrently
(D) many processes can write to this file concurrently', 'Shared lock 類似 reader lock,多個 process 可以同時取得(同時讀取)。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (82, 2, 49, 'choice', 'Which of the following statements is not true about spinlocks in Linux?

(A) Spinlocks cannot be used on single processor machines.
(B) A thread may disable kernel preemption on Symmetric Multi-Processing machines instead of acquiring spinlocks.
(C) A thread that acquires a spinlock cannot acquire the same lock a second time without first releasing the lock.
(D) The Linux kernel is designed so that the spinlock is held only for only short durations.', 'Linux 在 SMP 上用 spinlock;在單處理器上才改用關閉 kernel preemption 取代 spinlock。(B) 把兩者顛倒了。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (83, 2, 50, 'choice', 'Which of the following is true for the solutions to critical-section problems?

(A) No deadlock implies progress, and progress implies bounded waiting
(B) Bounded waiting implies progress, and progress implies no deadlock
(C) Progress implies no deadlock, and no deadlock implies bounded waiting
(D) Bounded waiting implies no deadlock, and no deadlock implies progress.', '條件由強到弱:bounded waiting ⇒ progress ⇒ no deadlock。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (84, 2, 51, 'essay', '(5 pts) A classical solution to race condition is to associate a variable called lock. Then, we can use the following code for checking if we can enter critical section or not. However, this solution is not correct and can cause race condition. Why?

```text
lock = 0;
while (lock != 0);
lock = 1;
    Critical Section
lock = 0;
```

Figure 3.', '「檢查 lock」與「設定 lock = 1」是兩個分開的動作,不是 atomic 的。P0 看到 `lock == 0` 跳出迴圈,在執行 `lock = 1` 之前被切換;P1 也看到 `lock == 0` 而進入。接著 P0 恢復執行,也進入,兩者同時在 critical section 中。lock 本身就是共享變數,對它的存取也有 race condition。需要 test-and-set 等 atomic 指令把「檢查並設定」合成一步。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (85, 2, 52, 'choice', 'There are two critical sections access method used by processes P1 and P2 as following shows, where the initial values of shared Boolean variable S1 and S2 are randomly assigned.

Method Used by P1

```text
while (S1 == S2) ;
Critical Section
S1 = S2;
```

Method Used by P2

```text
while (S1 != S2) ;
Critical Section
S2 = not (S1);
```

Which one of the following statements describes the properties achieved?

(a) Mutual exclusion but not progress
(b) Progress but not mutual exclusion
(c) Neither mutual exclusion nor progress
(d) Both mutual exclusion and progress', 'P1 只在 S1 ≠ S2 時進入,P2 只在 S1 == S2 時進入,兩者不可能同時進入。但離開時 P1 讓 S1 = S2(輪到 P2),P2 讓 S2 ≠ S1(輪到 P1),必須嚴格輪流,progress 不滿足。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (86, 2, 53, 'choice', '(5 pts) Regarding the critical-section problem and synchronization, select correct description(s).

(A) A resource-allocation graph has a cycle if and only if there is a deadlock.
(B) The "progress" requirement implies the "bounded waiting" requirement.
(C) The "bounded waiting" requirement implies the "progress" requirement.
(D) The "freedom from deadlock" property implies the "freedom from starvation" property.
(E) The "freedom from starvation" property implies the "freedom from deadlock" property.', '(A) 每種資源只有一個 instance 時才是充要條件,有多個 instance 時有 cycle 不一定 deadlock。條件強弱:bounded waiting ⇒ progress;starvation-free ⇒ deadlock-free,反之不成立。', 'CE');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (87, 2, 53, 'truefalse', 'Does starvation-freedom imply deadlock-freedom?', '是。沒有 starvation 表示每個 process 最後都能進入,自然不會 deadlock;反過來,沒有 deadlock 仍可能有 process 一直搶不到(starvation)。', 'T');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (88, 2, 54, 'essay', 'Explain why interrupts are not appropriate for implementing synchronization primitives in multiprocessor systems. (5%)', '關中斷只對執行該指令的那顆 CPU 有效,其他 CPU 上的 process 仍可同時進入 critical section,無法達成 mutual exclusion。若要關閉所有 CPU 的中斷,必須送訊息給每顆 CPU,非常耗時,會延遲進入 critical section 並降低系統效率,而且關中斷太久也會影響 timer 與 I/O 中斷的處理。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (89, 2, 55, 'choice', 'Which of the following terms is a hardware-based synchronization tool?

(a) CAS instruction
(b) Peterson''s Solution
(c) DMA
(d) Banker''s algorithms
(e) MMU', 'CAS(compare-and-swap)是硬體提供的 atomic 指令;Peterson''s 是軟體解法;DMA、MMU 是硬體但與同步無關;Banker''s algorithm 用於 deadlock avoidance。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (90, 2, 56, 'choice', 'Several processes access the same data concurrently and the result of the execution depends on the particular order in which the access takes places. We call this as \_\_\_\_

(A) Critical section
(B) Race condition
(C) Mutually exclusive
(D) Writing ordering
(E) None of above', '這正是 race condition 的定義。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (91, 2, 57, 'essay', 'Please write down a multithread program in pseudo code to explain race condition.', '```c
int count = 0;

void *worker(void *arg) {
    for (int i = 0; i < 100000; i++)
        count++;              // load → add → store,不是 atomic
    return NULL;
}

int main() {
    pthread_t t1, t2;
    pthread_create(&t1, NULL, worker, NULL);
    pthread_create(&t2, NULL, worker, NULL);
    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
    printf("%d\n", count);    // 預期 200000,實際常常比較小
}
```
兩個 thread 可能同時讀到相同的 count(例如 5),各自加 1 後都寫回 6,其中一次加法遺失。結果取決於執行的交錯順序,這就是 race condition。用 mutex 保護 `count++` 即可解決。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (92, 2, 58, 'choice', 'Consider the following C code for creating two threads. Which statement(s) are correct?

```c
// header files here
int count = 0;

void *mythread(void *arg) {
  for (int i=0; i<10000; i++) {
    // wait for some time
    count += 1;
  }
  return(NULL);
}

int main() {
  pthread_t p1, p2;
  pthread_create(&p1, NULL, mythread, NULL);
  pthread_create(&p2, NULL, mythread, NULL);
  pthread_join(p2, NULL); pthread_join(p1, NULL);
  printf("%d", count);
  return 0;
}
```

(a) The output is always 20000.
(b) It is possible that the output is 19999.
(c) The output is fixed to 20000 if we change the order of the two calls to `pthread_join`.
(d) The first thread has a higher priority than the second one in thread scheduling.', '`count += 1` 不是 atomic,兩個 thread 交錯執行會遺失更新,結果可能小於 20000。join 的順序只影響等待的順序,不影響結果;建立順序也與優先權無關。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (93, 2, 59, 'choice', '[2%]

Which of the following statements is not true about spinlocks in Linux?

(A) Spinlocks cannot be used on single processor machines.
(B) A thread may disable kernel preemption on Symmetric Multi-Processing machines instead of acquiring spinlocks.
(C) A thread that acquires a spinlock cannot acquire the same lock a second time without first releasing the lock.
(D) The Linux kernel is designed so that the spinlock is held only for only short durations.', 'Linux 在 SMP 上用 spinlock;在單處理器上才改用關閉 kernel preemption 取代 spinlock。(B) 把兩者顛倒了。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (94, 2, 60, 'choice', 'While a process is in its critical section, any other process that tries to enter its critical section must loop continuously in the call to acquire the lock is called a \_\_\_\_.

(a) Trap
(b) Interrupt
(c) Spinlock
(d) Monitor', '取得 lock 時持續空轉等待的鎖稱為 spinlock。', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (95, 2, 61, 'choice', 'Which of the following statement is false?

(a) Race conditions can result in corrupted values of shared data
(b) The preemptive kernel may be more responsive than non-preemptive kernel.
(c) Peterson''s solution works on modern computer architectures
(d) Semaphores and mutex locks both provide mutual exclusion.', '現代處理器與編譯器可能重排沒有相依關係的讀寫指令,Peterson''s solution 在現代架構上不保證正確,需要 memory barrier。', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (96, 2, 62, 'choice', 'Which of the following is false?

(a) POSIX Mutex Lock fulfills mutual exclusion and bounded waiting condition
(b) Semaphore fulfills mutual exclusion, bounded waiting, and progress condition
(c) Semaphore has a waiting queue associated with it
(d) When a process calls the wait() operation and finds that the semaphore value is not positive, it will suspend itself', 'POSIX mutex 只保證 mutual exclusion,不保證取得 lock 的順序(公平性),所以不保證 bounded waiting。⚠ 本題解答有分歧(也有人認為 (b) 錯),請再確認。', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (97, 2, 63, 'choice', 'Which of the following statements is correct?

(a) The count++ statement in a C program is atomic.
(b) Race condition occurs when several processes access and manipulate the same data concurrently
(c) On multiple-processor machines, we could simply disable the interrupts to prevent race condition
(d) Memory barrier is a solution to the critical section problem', '(a) `count++` 是 load-add-store;(c) 關中斷只影響單一 CPU;(d) memory barrier 只保證記憶體操作的順序,本身不是 critical section 的解法。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (98, 2, 64, 'choice', 'A set of properties that a system must satisfy to ensure that processes make progress during their execution life cycle.

(a) Safety
(b) Liveness
(c) Responsiveness
(d) Progressiveness', 'Liveness 指系統必須保證 process 在執行過程中能持續前進;deadlock、priority inversion 都是 liveness failure。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (99, 2, 65, 'choice', 'In Linux, the number of locks being held by a task is called

(a) mutex_lock_count
(b) preempt_count
(c) lock_count
(d) none of the above', 'Linux 的每個 task 有 `preempt_count` 記錄持有的 lock 數量,大於 0 時 kernel 不能被搶占。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (100, 2, 66, 'essay', '(15 points) Please answer the following question about synchronization.

(a) (4 points) What is a critical section?
(b) (2 points) What is busy waiting?
(c) (4 points) What are the advantages and disadvantages of busy waiting?
(d) (5 points) How can we avoid busy waiting?', '(a) 存取共享資料的程式片段,同一時間只能有一個 process 執行。
(b) Process 在迴圈中不斷檢查條件來等待,佔用 CPU 空轉。
(c) 優點:不需要 context switch,等待時間短時(多處理器)效率高。缺點:浪費 CPU 時間;單處理器上會拖延持有者釋放鎖。
(d) 使用具有 waiting queue 的 semaphore / mutex:拿不到資源時呼叫 `block()`(sleep)把自己放進 waiting queue 並讓出 CPU,資源釋放時由 `signal()` 呼叫 `wakeup()` 喚醒。也可以用 condition variable 或 monitor。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (101, 2, 67, 'essay', '(a) (6%) There are three common types of hardware support to address the critical-section problem. Please briefly explain them.
(b) (4%) Please explain two fundamental IPC (inter-process communication) models.', '(a)
- **Memory barriers(memory fences)**:強制在 barrier 之前的記憶體讀寫都完成並對其他處理器可見,之後的操作才能執行,避免指令重排破壞同步。
- **Hardware instructions**:test-and-set、compare-and-swap 等 atomic 指令,可在一個不可中斷的步驟內完成「讀取並修改」,用來實作 lock。
- **Atomic variables**:以 CAS 實作的整數、布林等型別,提供 atomic 的 increment 等操作。

(b) **Shared memory**:process 共享一塊記憶體直接讀寫,建立後不需 kernel 介入,速度快,但需自行同步。**Message passing**:透過 kernel 提供的 send / receive 交換訊息,容易實作、適合分散式系統,但每次都要 system call,較慢。', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (102, 2, 68, 'essay', '(c) A \_\_\_\_ condition may occur when several processes access the same data concurrently. Hence, the outcome of execution depends on a particular order in which the access takes place.', '**race**(race condition)', NULL);
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (103, 2, 69, 'choice', 'Which of the following critical-section problem''s requirements ensures programs will cooperatively determined what process will next enter its critical section?

(A) mutual exclusion
(B) progress
(C) bounded waiting
(D) none of the above', 'Progress:只有不在 remainder section 的 process 能參與決定下一個進入 critical section 的人。', 'B');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (104, 2, 70, 'choice', 'Which of the following is true for the solutions to critical-section problems?

(A) Bounded waiting implies progress, and progress implies no deadlock
(B) No deadlock implies progress, and progress implies bounded waiting
(C) Progress implies no deadlock, and no deadlock implies bounded waiting
(D) Bounded waiting implies no deadlock, and no deadlock implies progress', '條件由強到弱:bounded waiting ⇒ progress ⇒ no deadlock。(原題部分文字不清,選項依同類題還原。)', 'A');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (105, 2, 71, 'choice', 'Which of the following variables are shared between the processes in Peterson''s solution?

(A) int turn
(B) boolean flag[2]
(C) both of the above
(D) none of the above', 'Peterson''s solution 共享 `int turn` 與 `boolean flag[2]`。(原題部分文字不清,選項依標準教材還原。)', 'C');
INSERT INTO questions (id, chapter_id, number, type, content, answer, correct) VALUES (106, 2, 72, 'choice', '13. Consider the enter_CS() and leave_CS() functions to implement critical section of a process are realized using test-and-set instruction as follows: (單選 2%)

```c
void enter_CS(X)
{
    while test-and-set(X) ;
}
void leave_CS(X)
{
    X = 0;
}
```

In the above solution, X is a memory location associated with the CS and is initialized to 0. Now consider the following statements:

I. The above solution to CS problem is deadlock-free
II. The solution is starvation free.
III. The processes enter CS in FIFO order.
IV. More than one process can enter CS at the same time.

Which of the above statements is true?

(A) I only
(B) I and II
(C) II and III
(D) IV only', 'lock 釋放後總有一個 process 能拿到,所以 deadlock-free;但誰拿到不確定,不保證 starvation-free,也不是 FIFO;test-and-set 是 atomic 的,不會有兩個 process 同時進入。', 'A');
