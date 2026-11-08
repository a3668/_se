INSERT INTO questions (chapter, number, type, content) VALUES
('第四章:程序之間的溝通及同步問題', 2, 'choice', 'Which of the following statements is true regarding the Interprocess communication?

(A) Shared memory is typically faster than message passing.
(B) Message passing is typically faster than shared memory.
(C) Message passing is most useful for exchanging large amounts of data.
(D) Shared memory is far more common in operating systems than message passing.'),

('第四章:程序之間的溝通及同步問題', 3, 'choice', 'Which of the following statements is correct?

(a) Operating systems usually move processes from one processor to another to improve cache usability.
(b) Fixing process priorities results in starvation of high-priority processes.
(c) Two threads of a process cannot simultaneously perform on a multicore processor.
(d) During inter-process communication, a sender process has to block until the recipient receives the message if there is no message buffering.
(e) None of the above statements are correct.'),

('第四章:程序之間的溝通及同步問題', 4, 'essay', '9. (15%) (part-1) Explain why spinlocks are not appropriate for single-processor systems yet are often used in multiprocessor systems. (part-2) Explain why implementing synchronization primitives by disabling interrupts is not appropriate in single-processor system if the synchronization primitives are to be used in user-level programs. (part-3) Describe how the Swap() instruction can be used to provide mutual exclusion that satisfies the bounded-waiting requirement.'),

('第四章:程序之間的溝通及同步問題', 5, 'choice', '5. (6%) For two processes on the same machine to communicate with each other, which of the following mechanisms do not require any kernel intervention at all?

(a) Message passing.
(b) Remote procedure call.
(c) Shared memory.
(d) TCP/IP socket.
(e) All of the above require some kernel intervention.'),

('第四章:程序之間的溝通及同步問題', 6, 'choice', 'Consider a two-processor system running three processes P1, P2, and P3. The processes P1 and P2 run on the first CPU, while the process P3 runs on the second CPU. All these three processes share one mutually exclusive resource. Suppose that processes never migrate from a CPU to the other one. In terms of CPU utilization and hardware cost, which one of the following design options is improper?

(A) Using interrupt disabling to synchronize processes P1 and P2.
(B) Using interrupt disabling to synchronize processes P1 and P3.
(C) Using spin locks to synchronize processes P1 and P3.
(D) None of the above.'),

('第四章:程序之間的溝通及同步問題', 7, 'essay', 'Suppose that a process is executing “counter = counter + 1” while another process is executing concurrently (without any synchronization) “counter = counter − 2”, where the counter is a variable shared between the two processes and is only changed in those statements. Given that the value of counter is five before execution, give all the possible value(s) after both processes finish their statement. (7%)'),

('第四章:程序之間的溝通及同步問題', 8, 'choice', '6. Which are correct for synchronization?

(A) Disabling interrupts on a multiprocessor is a feasible way for solving the critical-section problem.
(B) The TestAndSet() and Swap() instructions are two special hardware instructions for solving the critical-section problem.
(C) Using spinlocks is a good approach in a multiprocessor system.
(D) Deadlocks never happen in the implementation of a semaphore with a waiting queue.'),

('第四章:程序之間的溝通及同步問題', 9, 'essay', '(5 points) Explain why implementing synchronization primitives by disabling interrupts is not appropriate in a single-processor system if the synchronization primitives are to be used in a user-level program.'),

('第四章:程序之間的溝通及同步問題', 10, 'choice', 'Which of the following statements is wrong regarding the Interprocess Communication?

(A) Message passing is easier to implement in a distributed system than shared memory.
(B) For direct communication, a link is established automatically between every pair of processes that want to communicate.
(C) For indirect communication, between each pair of communicating processes, there may be a number of different links, with each link corresponding to one mailbox.
(D) As for the message passing systems, “non-blocking send” can be used in the case of “zero capacity” buffering.'),

('第四章:程序之間的溝通及同步問題', 11, 'choice', 'A race condition \_\_\_\_.

(A) results when several threads try to access the same data concurrently
(B) results when several threads try to access and modify the same data concurrently
(C) will result only if the outcome of execution does not depend on the order in which instructions are executed
(D) None of the above'),

('第四章:程序之間的溝通及同步問題', 12, 'essay', '[System Structures] Please answer the followings:

a) (3%) What system calls have to be executed by a command interpreter or shell in order to start a new process?
b) (4%) What are the two modes of interprocess communication? What are the strengths and weaknesses of the two approaches?'),

('第四章:程序之間的溝通及同步問題', 13, 'essay', '[Synchronization] (5%) Race conditions are possible in many computer systems. Consider a banking system that maintains an account balance with two functions: deposit(amount) and withdraw(amount). These two functions are passed the amount that is to be deposited or withdrawn from the bank account balance. Assume that a husband and wife share a bank account. Concurrently, the husband calls the withdraw() function and the wife calls deposit(). Describe how a race condition is possible and what might be done to prevent the race condition from occurring.'),

('第四章:程序之間的溝通及同步問題', 14, 'essay', '(16 分) Please answer following questions about Synchronization and Deadlock:

(a) Explain why spinlocks are not appropriate for single-processor systems yet are often used in multiprocessor systems? (4 分)
(b) Explain what is race condition? Please give an example. (4 分)
(c) Explain what is deadlock? (4 分)
(d) Name the four conditions that prevent deadlock. (4 分)'),

('第四章:程序之間的溝通及同步問題', 15, 'choice', '[5 pts.] Spinlock synchronization schemes are “not” appropriate in which system?

(A) Single processor system
(B) Multi core system
(C) Multi-processor system
(D) Multiple computer system
(E) Real Time system'),

('第四章:程序之間的溝通及同步問題', 17, 'choice', 'We illustrated the idea of the need for synchronization between processes by showing a problem with an instruction like X=X+1. What was the problem with this instruction?

(A) The compiler left a number in a register.
(B) The compiler produced code that was not reentrant.
(C) It was not atomic.
(D) Modern pipelined CPUs would execute things in the wrong order.
(E) None of the above explains the problem with this instruction.'),

('第四章:程序之間的溝通及同步問題', 18, 'choice', '4. Which statements are correct?

(A) Busy waiting is the situation that a process is waiting for an event while it is executing instructions in a loop in the running state.
(B) A spinlock is a lock which causes a thread trying to acquire it using busy waiting.
(C) Rather than busy waiting, the process can block itself. The block operation places a process into a waiting queue and sleep.
(D) Busy waiting is not efficient and does not use anymore in a multiprocessor system.'),

('第四章:程序之間的溝通及同步問題', 19, 'essay', '[10%] When multiple processes need to cooperate, there is a choice between shared memory and inter-process communication (IPC). Compare and contrast these two techniques. Make sure to clarify the role of the operating system in each.'),

('第四章:程序之間的溝通及同步問題', 20, 'essay', '[Process Management: 15%]

1. Explain the two basic models of inter-process communication. (4%)
2. When will a race condition occur? (2%)
3. What are the three requirements that a critical-section solution should meet? (3%)
4. What is the difference between deadlock prevention and deadlock avoidance? (4%)
5. When will priority inversion occur in process synchronization? (2%)'),

('第四章:程序之間的溝通及同步問題', 21, 'choice', 'Choose the correct statements from the multiple choices regarding atomic transactions.

(A) An un-interruptible unit is known as atomic.
(B) Incrementing an integer value can always be performed atomically.
(C) The TestAndSet instruction is executed atomically.
(D) The mutual exclusion of critical sections ensures that the critical sections are executed atomically.
(E) None of the above.'),

('第四章:程序之間的溝通及同步問題', 22, 'choice', 'Shared memory is a very fast mechanism for interprocess communication because both processes can see any changes instantly. What is the main drawback to shared memory?

(A) It is limited to a small space.
(B) It requires an OS call.
(C) It is limited to two processes at one time.
(D) It may require synchronization.
(E) None of the above is a drawback to shared memory.'),

('第四章:程序之間的溝通及同步問題', 23, 'choice', '(10%) Which of the following statements about synchronization are true?

(a) If the wait and signal operations are not executed atomically, then mutual exclusion may be violated.
(b) If the conditions of mutual exclusion, hold and wait, no preemption, and circular wait hold simultaneously in a system, then a deadline situation must arise.
(c) Spinlocks are not appropriate for uniprocessor systems.
(d) Semaphores and conditional critical regions are equivalent.
(e) None of the above are true.'),

('第四章:程序之間的溝通及同步問題', 24, 'essay', '[10%] Why do Solaris, Linux, and Windows 2000 use spinlocks as a synchronization mechanism only on multiprocessor systems and not on single-processor systems?'),

('第四章:程序之間的溝通及同步問題', 25, 'essay', '1. What is a race condition? How to solve it? (4%)
2. What is the difference between deadlock prevention and deadlock avoidance? (4%)
3. When will you need to use a condition variable? (4%)
4. What is the difference between asynchronous and deferred cancellation of a target thread? (4%)
5. What are the four common conditions to cause process termination? (4%)'),

('第四章:程序之間的溝通及同步問題', 26, 'essay', '[Synchronization and Deadlock: 20%]

1. Explain how the deadlock prevention scheme works. (8%)
2. Give three requirements for any solution to the critical-section problem. (6%)
3. What is the priority inversion problem? How to solve it? (4%)
4. What is conflict serializable for a non-serial schedule? (2%)'),

('第四章:程序之間的溝通及同步問題', 27, 'choice', 'Choose the correct statements from the multiple choices.

(a) Data access is one of reasons for process migration.
(b) The standard UNIX pipe mechanism allows process migration.
(c) Modularity is one of reasons for process cooperation.
(d) Shared memory is one of models for interprocess communications among cooperating processes.
(e) None of the above.'),

('第四章:程序之間的溝通及同步問題', 29, 'essay', '(10%) Describe the two fundamental models of inter-process communication.'),

('第四章:程序之間的溝通及同步問題', 30, 'choice', '(2%) A message-passing model is \_\_\_\_.

(a) easier to implement than a shared memory model for intercomputer communication
(b) faster than the shared memory model
(c) a network protocol, and does not apply to operating systems
(d) only useful for small simple operating systems'),

('第四章:程序之間的溝通及同步問題', 30, 'truefalse', '(1%) All access to POSIX shared memory requires a system call.'),

('第四章:程序之間的溝通及同步問題', 31, 'choice', 'Which of the following is correct about Direct Communication?

(a) processes must name each other explicitly
(b) Messages are exchanged via mailboxes
(c) Link established only if processes share a common mailbox
(d) Mailbox can be owned either by OS or processes'),

('第四章:程序之間的溝通及同步問題', 32, 'choice', 'Which of the following IPC mechanism is easier to implement in a distributed system?

(A) shared memory
(B) message passing
(C) socket communication
(D) ordinary pipe');
