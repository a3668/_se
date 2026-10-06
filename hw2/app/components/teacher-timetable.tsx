type Lesson = {
  offeringId: number;
  code: string;
  name: string;
  section: string;
  classroom: string | null;
  weekday: number | null;
  startPeriod: number | null;
  endPeriod: number | null;
};

const weekdays = [
  ["一", "Monday"], ["二", "Tuesday"], ["三", "Wednesday"],
  ["四", "Thursday"], ["五", "Friday"], ["六", "Saturday"], ["日", "Sunday"],
];

const periodTimes = [
  "0810–0900", "0910–1000", "1010–1100", "1110–1200",
  "1330–1420", "1430–1520", "1530–1620", "1630–1720",
];

export function TeacherTimetable({ lessons, teacherName, semester, title = "授課課表" }: {
  lessons: Lesson[];
  teacherName: string;
  semester: string;
  title?: string;
}) {
  return (
    <div className="admin-schedule-wrapper">
      <table className="admin-schedule-table" aria-label={`${teacherName} · ${semester} ${title}`}>
        <caption>【{title}】</caption>
        <thead>
          <tr>
            <th scope="col">節次</th>
            {weekdays.map(([day, english]) => <th scope="col" key={day}>{day} ({english})</th>)}
          </tr>
        </thead>
        <tbody>
          {periodTimes.map((time, index) => {
            const period = index + 1;
            return (
              <tr key={period}>
                <th scope="row">
                  <span>第 {period} 節</span>
                  <span>{time}</span>
                </th>
                {weekdays.map(([day], index) => (
                  <td key={day}>
                    {lessons.filter((lesson) => lesson.weekday === index + 1
                      && lesson.startPeriod !== null && lesson.endPeriod !== null
                      && lesson.startPeriod <= period && lesson.endPeriod >= period).map((lesson) => (
                      <div className="admin-schedule-lesson" key={`${lesson.offeringId}-${lesson.startPeriod}-${lesson.endPeriod}`}>
                        <span>{lesson.name}</span>
                        <span>{lesson.code} · {lesson.section} 班</span>
                        <span>{lesson.classroom || "教室未定"}</span>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
