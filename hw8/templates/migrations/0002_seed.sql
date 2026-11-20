-- 範例題目:選擇題(單選、多選)、是非題、問答題各幾題
-- 改成自己的題目:在第一次 db:init 前直接修改這個檔案;已經匯入過的話,新增 0003_xxx.sql 再執行 db:init(已套用的 migration 不會重跑)

INSERT INTO questions (chapter, number, type, content, correct, answer) VALUES ('第四章:程序之間的溝通及同步問題', 2, 'choice', 'Which of the following statements is true regarding the Interprocess communication?

(A) Shared memory is typically faster than message passing.
(B) Message passing is typically faster than shared memory.
(C) Message passing is most useful for exchanging large amounts of data.
(D) Shared memory is far more common in operating systems than message passing.', 'A', 'Shared memory 建立後存取不需經過 kernel,通常比 message passing 快;message passing 適合少量資料。');

INSERT INTO questions (chapter, number, type, content, correct, answer) VALUES ('第四章:程序之間的溝通及同步問題', 4, 'essay', '9. (15%) (part-1) Explain why spinlocks are not appropriate for single-processor systems yet are often used in multiprocessor systems. (part-2) Explain why implementing synchronization primitives by disabling interrupts is not appropriate in single-processor system if the synchronization primitives are to be used in user-level programs. (part-3) Describe how the Swap() instruction can be used to provide mutual exclusion that satisfies the bounded-waiting requirement.', NULL, '1. **Spinlock**:單處理器上,等待鎖的 process 一直 spin 會佔住唯一的 CPU,持有鎖的 process 無法執行來釋放鎖,只會浪費 CPU 時間,直到 time slice 用完。多處理器上,持有鎖的 process 在另一顆 CPU 上執行,鎖很快就會釋放,spin 一下的成本比 context switch 小。
2. **關中斷**:關中斷是特權指令,user-level 程式不能執行。就算允許,user 程式也可能一直不開中斷,讓 timer 中斷失效、獨占 CPU,系統就無法排班。
3. **Swap 達成 bounded waiting**:用 `waiting[n]` 陣列與共享的 `lock`。process i 設 `waiting[i]=true; key=true;`,在 `while (waiting[i] && key) Swap(&lock, &key);` 迴圈中等待。離開 critical section 時,依 (i+1)…(i+n-1) 的順序找下一個 `waiting[j]==true` 的 j:找到就設 `waiting[j]=false` 把進入權交給 j,沒有就設 `lock=false`。因此任何等待者最多等 n−1 輪。');

INSERT INTO questions (chapter, number, type, content, correct, answer) VALUES ('第四章:程序之間的溝通及同步問題', 7, 'essay', 'Suppose that a process is executing “counter = counter + 1” while another process is executing concurrently (without any synchronization) “counter = counter − 2”, where the counter is a variable shared between the two processes and is only changed in those statements. Given that the value of counter is five before execution, give all the possible value(s) after both processes finish their statement. (7%)', NULL, '可能的結果為 **3、4、6**。
- 依序執行(無交錯):5+1−2 = 4。
- 兩者都先讀到 5:+1 的結果最後寫回,得 6;−2 的結果最後寫回,得 3。');

INSERT INTO questions (chapter, number, type, content, correct, answer) VALUES ('第四章:程序之間的溝通及同步問題', 8, 'choice', '6. Which are correct for synchronization?

(A) Disabling interrupts on a multiprocessor is a feasible way for solving the critical-section problem.
(B) The TestAndSet() and Swap() instructions are two special hardware instructions for solving the critical-section problem.
(C) Using spinlocks is a good approach in a multiprocessor system.
(D) Deadlocks never happen in the implementation of a semaphore with a waiting queue.', 'BC', '(A) 多處理器上關中斷只影響單一 CPU,不可行;(D) 使用 waiting queue 的 semaphore 仍可能發生 deadlock(如兩個 process 以相反順序 wait 兩個 semaphore)。');

INSERT INTO questions (chapter, number, type, content, correct, answer) VALUES ('第四章:程序之間的溝通及同步問題', 30, 'truefalse', '(1%) All access to POSIX shared memory requires a system call.', 'F', '只有建立與 mapping(shm_open、mmap)需要 system call;mapping 完成後就是一般的記憶體存取,不需 system call。');

INSERT INTO questions (chapter, number, type, content, correct, answer) VALUES ('第四章:程序之間的溝通及同步問題(p4-26 起)', 43, 'truefalse', '[2 points] Modularity is one of the reasons to support process cooperation.', 'T', 'Process cooperation 的理由:information sharing、computation speedup、modularity、convenience。');

