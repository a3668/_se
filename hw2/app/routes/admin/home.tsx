export function meta() {
  return [{ title: "管理後台｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export default function AdminHome() {
  return (
    <main className="admin-home">
      <p className="admin-eyebrow">Administration</p>
      <h1>管理後台</h1>
      <p>管理學生與教師帳號、基本資料、加退選開放年級，以及全校停修申請、通識初選、期中預警與學期成績查詢開關。</p>
    </main>
  );
}
