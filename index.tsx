import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";

const APP_STORAGE_KEY = "reading-tracker-data";

// --- Helper Functions ---
const getTodayDateString = () => {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
};

const getMonthFromDateString = (dateString: string) => {
  return dateString.substring(0, 7); // YYYY-MM
};

const calculateConsecutiveDays = (user: string, records: Records): number => {
    let count = 0;
    const d = new Date();
    while (true) {
        const dateStr = d.toISOString().split('T')[0];
        if (records[dateStr] && records[dateStr][user]) {
            count++;
            d.setDate(d.getDate() - 1); // Move to previous day
        } else {
            break; // Streak is broken
        }
    }
    return count;
};


// --- Data Layer ---
const getInitialData = () => {
  try {
    const rawData = localStorage.getItem(APP_STORAGE_KEY);
    if (rawData) {
      const data = JSON.parse(rawData);
      // Basic validation
      if (Array.isArray(data.users) && typeof data.records === 'object') {
        return data;
      }
    }
  } catch (error) {
    console.error("Failed to parse data from localStorage", error);
  }
  // Default initial state
  return {
    users: ["爱丽丝", "鲍勃", "查理", "黛娜", "伊芙"],
    records: {},
  };
};

type Records = {
  [date: string]: {
    [user: string]: number;
  };
};

type EditingState = { user: string; chapters: string } | null;


// --- React Components ---

const CheckInForm = ({ users, onCheckIn }: { users: string[], onCheckIn: (user: string, chapters: number) => void }) => {
  const [selectedUser, setSelectedUser] = useState<string>(users[0] || "");
  const [chapters, setChapters] = useState<number | string>("");

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || chapters === "" || +chapters <= 0) {
      alert("请选择一位成员并输入有效的章节数。");
      return;
    }
    onCheckIn(selectedUser, +chapters);
    setChapters(""); // Reset after submission
  };

  return (
    <form onSubmit={handleSubmit} className="checkin-form" aria-labelledby="checkin-heading">
      <div className="form-group">
        <label htmlFor="user-select">选择成员</label>
        <select id="user-select" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} disabled={users.length === 0}>
          {users.map(user => <option key={user} value={user}>{user}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="chapters-input">阅读章节数</label>
        <input
          id="chapters-input"
          type="number"
          value={chapters}
          onChange={(e) => setChapters(e.target.value)}
          placeholder="例如: 3"
          min="1"
        />
      </div>
      <button type="submit" className="button button-primary">打卡</button>
    </form>
  );
};

const DailyReport = ({ users, records, onRemoveUser, onUpdateRecord }: { users: string[], records: Records, onRemoveUser: (user: string) => void; onUpdateRecord: (user:string, chapters: number) => void }) => {
  const today = getTodayDateString();
  const todaysRecords = records[today] || {};
  const [editingState, setEditingState] = useState<EditingState>(null);

  const handleStartEdit = (user: string, chapters: number) => {
    setEditingState({ user, chapters: String(chapters) });
  };
  
  const handleCancelEdit = () => {
    setEditingState(null);
  };

  const handleSave = () => {
    if (editingState && +editingState.chapters > 0) {
      onUpdateRecord(editingState.user, +editingState.chapters);
      setEditingState(null);
    } else {
      alert("请输入有效的章节数。");
    }
  };


  return (
    <div role="region" aria-labelledby="daily-report-heading">
        <h2 id="daily-report-heading">今日打卡情况 ({today})</h2>
        <table>
            <thead>
            <tr>
                <th>成员</th>
                <th>已读章节</th>
                <th>状态</th>
                <th className="manage-user-cell">管理</th>
            </tr>
            </thead>
            <tbody>
            {users.length > 0 ? users.map(user => {
                const checkedIn = todaysRecords.hasOwnProperty(user);
                const chaptersRead = todaysRecords[user];
                const isEditing = editingState?.user === user;

                return (
                <tr key={user}>
                    <td>{user}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          className="edit-input"
                          value={editingState.chapters}
                          onChange={(e) => setEditingState({ ...editingState, chapters: e.target.value })}
                          min="1"
                          autoFocus
                        />
                      ) : (
                        checkedIn ? chaptersRead : "—"
                      )}
                    </td>
                    <td className={checkedIn ? "status-checked-in" : "status-not-checked-in"}>
                      {checkedIn ? "✅ 已打卡" : "❌ 未打卡"}
                    </td>
                    <td className="manage-user-cell action-buttons">
                        {isEditing ? (
                          <>
                            <button onClick={handleSave} className="button button-success">保存</button>
                            <button onClick={handleCancelEdit} className="button button-secondary">取消</button>
                          </>
                        ) : (
                          <>
                            {checkedIn && <button onClick={() => handleStartEdit(user, chaptersRead)} className="button button-edit">编辑</button>}
                            <button onClick={() => onRemoveUser(user)} className="button button-danger">删除</button>
                          </>
                        )}
                    </td>
                </tr>
                );
            }) : (
                <tr>
                    <td colSpan={4} style={{textAlign: 'center'}}>请先添加成员。</td>
                </tr>
            )}
            </tbody>
        </table>
    </div>
  );
};

const MonthlyLeaderboard = ({ users, records, onExport }: { users: string[], records: Records, onExport: () => void }) => {
  const currentMonth = getMonthFromDateString(getTodayDateString());
  
  const monthlyStats = useMemo(() => {
    const totals: { [user: string]: number } = {};
    users.forEach(user => totals[user] = 0);

    for (const date in records) {
      if (getMonthFromDateString(date) === currentMonth) {
        for (const user in records[date]) {
          if (totals.hasOwnProperty(user)) {
            totals[user] += records[date][user];
          }
        }
      }
    }
    return Object.entries(totals)
      .map(([user, total]) => ({
        user,
        total,
        consecutiveDays: calculateConsecutiveDays(user, records),
      }))
      .sort((a, b) => b.total - a.total);
  }, [users, records, currentMonth]);

  return (
    <details>
      <summary>本月排行榜 ({currentMonth})</summary>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>成员</th>
              <th>本月总章节</th>
              <th>连续打卡</th>
            </tr>
          </thead>
          <tbody>
            {monthlyStats.length > 0 ? monthlyStats.map(({ user, total, consecutiveDays }, index) => (
              <tr key={user}>
                <td className="rank-cell">{index + 1}</td>
                <td>{user}</td>
                <td>{total}</td>
                <td>{consecutiveDays} 天</td>
              </tr>
            )) : (
                <tr>
                    <td colSpan={4} style={{textAlign: 'center'}}>本月尚无打卡记录。</td>
                </tr>
            )}
          </tbody>
        </table>
        <button onClick={onExport} className="button button-primary export-button">导出本月数据 (CSV)</button>
      </div>
    </details>
  );
};

const MonthlyChart = ({ records, users }: { records: Records, users: string[] }) => {
    const currentMonth = getMonthFromDateString(getTodayDateString());
    
    const chartData = useMemo(() => {
        const dailyCounts: { [day: number]: number } = {};
        const daysInMonth = new Date(new Date(currentMonth).getFullYear(), new Date(currentMonth).getMonth() + 1, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) {
            dailyCounts[i] = 0;
        }

        for (const date in records) {
            if (getMonthFromDateString(date) === currentMonth) {
                const day = new Date(date).getDate();
                // Count the number of users who checked in, not the sum of chapters
                const count = Object.keys(records[date]).length;
                dailyCounts[day] = count;
            }
        }
        return Object.entries(dailyCounts).map(([day, count]) => ({ day: Number(day), count }));
    }, [records, currentMonth]);

    const PADDING = 50;
    const SVG_WIDTH = 800;
    const SVG_HEIGHT = 400;
    const maxCount = Math.max(users.length, 5); // Y-axis max is total users, with a minimum of 5 for visual stability
    const points = chartData.map(d => {
        const x = PADDING + (d.day - 1) * (SVG_WIDTH - 2 * PADDING) / (chartData.length - 1 || 1);
        const y = SVG_HEIGHT - PADDING - (d.count / maxCount) * (SVG_HEIGHT - 2 * PADDING);
        return `${x},${y}`;
    }).join(' ');

    return (
        <section className="card">
            <h2>本月打卡活跃度</h2>
            <div className="chart-container">
                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} role="img" aria-labelledby="chart-title">
                    <title id="chart-title">每日打卡人数趋势图</title>
                    {/* Y Axis */}
                    <line x1={PADDING} y1={PADDING} x2={PADDING} y2={SVG_HEIGHT - PADDING} stroke="#ccc" />
                    <text x={PADDING - 15} y={PADDING} textAnchor="end" alignmentBaseline="middle">{maxCount}</text>
                    <text x={PADDING - 15} y={SVG_HEIGHT - PADDING} textAnchor="end" alignmentBaseline="middle">0</text>
                     <text x={15} y={(SVG_HEIGHT)/2} transform={`rotate(-90 15,${(SVG_HEIGHT)/2})`} textAnchor="middle">打卡人数</text>
                    
                    {/* X Axis */}
                    <line x1={PADDING} y1={SVG_HEIGHT - PADDING} x2={SVG_WIDTH - PADDING} y2={SVG_HEIGHT - PADDING} stroke="#ccc" />
                    <text x={PADDING} y={SVG_HEIGHT - PADDING + 20} textAnchor="start">1日</text>
                    <text x={SVG_WIDTH-PADDING} y={SVG_HEIGHT - PADDING + 20} textAnchor="end">{chartData.length}日</text>
                    <text x={SVG_WIDTH/2} y={SVG_HEIGHT - 10} textAnchor="middle">日期</text>

                    <polyline fill="none" stroke="var(--primary-color)" strokeWidth="3" points={points} />
                    {chartData.map(d => {
                        const x = PADDING + (d.day - 1) * (SVG_WIDTH - 2 * PADDING) / (chartData.length - 1 || 1);
                        const y = SVG_HEIGHT - PADDING - (d.count / maxCount) * (SVG_HEIGHT - 2 * PADDING);
                        return <circle key={d.day} cx={x} cy={y} r="4" fill="var(--primary-hover-color)"><title>{`${d.day}日: ${d.count}人打卡`}</title></circle>
                    })}
                </svg>
            </div>
        </section>
    );
};

const UserManagement = ({ onAddUser }: { onAddUser: (user: string) => void }) => {
  const [newUser, setNewUser] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.trim()) {
      onAddUser(newUser.trim());
      setNewUser("");
    }
  };

  return (
    <details>
      <summary>成员管理</summary>
      <div className="card">
        <form onSubmit={handleAdd} className="user-management-form">
          <div className="form-group">
            <label htmlFor="new-user-input">新成员姓名</label>
            <input
              id="new-user-input"
              type="text"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              placeholder="输入姓名后按回车或点击按钮"
            />
          </div>
          <button type="submit" className="button button-primary">添加成员</button>
        </form>
      </div>
    </details>
  );
};


// --- Main App Component ---
const App = () => {
  const [data, setData] = useState(getInitialData);
  const { users, records } = data;

  useEffect(() => {
    try {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save data to localStorage", error);
    }
  }, [data]);

  const handleCheckIn = (user: string, chapters: number) => {
    const today = getTodayDateString();
    setData(prevData => ({
      ...prevData,
      records: {
        ...prevData.records,
        [today]: {
          ...prevData.records[today],
          [user]: chapters,
        }
      }
    }));
  };

  const handleAddUser = (newUser: string) => {
    if (users.includes(newUser)) {
      alert(`成员 "${newUser}" 已存在。`);
      return;
    }
    setData(prevData => ({
      ...prevData,
      users: [...prevData.users, newUser],
    }));
  };

  const handleRemoveUser = (userToRemove: string) => {
    if (window.confirm(`确定要删除成员 "${userToRemove}" 吗？该成员的所有打卡记录也会被清理。`)) {
       setData(prevData => {
         const newUsers = prevData.users.filter(u => u !== userToRemove);
         const newRecords = { ...prevData.records };
         // Also remove user from all records
         Object.keys(newRecords).forEach(date => {
           if(newRecords[date][userToRemove]){
             delete newRecords[date][userToRemove];
           }
         });
         return { users: newUsers, records: newRecords };
       });
    }
  };

  const handleExportCSV = () => {
    const currentMonth = getMonthFromDateString(getTodayDateString());
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFDate,User,Chapters\r\n"; // \uFEFF for BOM

    const sortedDates = Object.keys(records).sort();

    for (const date of sortedDates) {
        if (getMonthFromDateString(date) === currentMonth) {
            for (const user in records[date]) {
                const row = [date, `"${user}"`, records[date][user]].join(',');
                csvContent += row + "\r\n";
            }
        }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reading_report_${currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <main>
      <h1>读书打卡</h1>
      
      <section className="card">
        <h2 id="checkin-heading">每日打卡</h2>
        <CheckInForm users={users} onCheckIn={handleCheckIn} />
      </section>

      <section className="card">
        <DailyReport users={users} records={records} onRemoveUser={handleRemoveUser} onUpdateRecord={handleCheckIn} />
      </section>

      <MonthlyChart records={records} users={users} />

      <MonthlyLeaderboard users={users} records={records} onExport={handleExportCSV} />

      <UserManagement onAddUser={handleAddUser} />

    </main>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}