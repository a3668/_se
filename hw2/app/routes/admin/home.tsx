export function meta() {
  return [{ title: "管理後台｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export default function AdminHome() {
  return (
    <main className="admin-home">
      <p className="admin-eyebrow">Administration</p>
      <h1>管理後台</h1>
      <p>管理員已登入。學生與老師帳號功能將於下一階段加入。</p>
    </main>
  );
}
