import { useEffect, useState } from 'react';
import PageContainer from '../../components/PageContainer.jsx';
import Sidebar from '../../components/Sidebar.jsx';
import { apiFetch } from '../../api/client.js';
import UserManagement from './UserManagement.jsx';
import BulkUpload from './BulkUpload.jsx';
import QuestionBank from './QuestionBank.jsx';
import AssessmentReports from './AssessmentReports.jsx';

const TABS = ['AI Analytics', 'Issue Reports', 'User Management', 'Bulk Upload', 'Question Bank', 'Assessment Reports'];

export default function AdminDashboard() {
  const [tab, setTab] = useState(TABS[0]);
  const [stats, setStats] = useState({aiCallsToday:0,callsLast7d:0,errorRate:0,topUser:'',topEndpoint:'',topTopic:''});
  const [logs, setLogs] = useState([]);
  const [logFilters, setLogFilters] = useState({q:'', endpoint:'', status:'', model:''});
  const [reports, setReports] = useState([]);
  const [reportFilters, setReportFilters] = useState({status:'open',q:''});
  const [responding, setResponding] = useState(null);
  const [responseMsg, setResponseMsg] = useState('');
  const [users, setUsers] = useState([]);
  const [questions, setQuestions] = useState([]);
  useEffect(() => {
    async function loadStats() {
      try { setStats(await apiFetch('/api/admin/ai-usage-stats')); } catch {}
    }
    loadStats();
  }, []);
  useEffect(() => {
    if(tab === 'AI Analytics') {
      apiFetch('/api/admin/ai-logs?' + new URLSearchParams(logFilters)).then(setLogs).catch(()=>{});
    }
  }, [tab, logFilters]);
  useEffect(() => {
    if(tab === 'Issue Reports') {
      apiFetch('/api/admin/reports?' + new URLSearchParams(reportFilters)).then(setReports).catch(()=>{});
    }
  }, [tab, reportFilters]);
  // ...future: fetch users, questions on relevant tabs
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <PageContainer>
          <h1 className="mb-6 text-3xl font-semibold">Admin Console</h1>
          <div className="mb-7 grid grid-cols-2 gap-4 md:grid-cols-6">
            <StatTile label="AI Calls Today" value={stats.aiCallsToday} accent="indigo" />
            <StatTile label="Past 7d" value={stats.callsLast7d} accent="blue" />
            <StatTile label="Error Rate" value={Math.round(stats.errorRate*100)+"%"} accent="rose" />
            <StatTile label="Top User" value={stats.topUser} accent="emerald" />
            <StatTile label="Top Endpoint" value={stats.topEndpoint} accent="emerald" />
            <StatTile label="Top Topic" value={stats.topTopic} accent="emerald" />
          </div>
          <div className="mb-6 flex gap-2 border-b pb-2 text-base font-medium">
            {TABS.map(t => (
              <button
                key={t}
                className={`rounded-t-lg px-6 py-2 transition-colors ${tab===t?"bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-emerald-300 shadow-md":"hover:bg-indigo-50 dark:hover:bg-slate-800/80 text-slate-500"}`}
                onClick={()=>setTab(t)}
              >{t}</button>
            ))}
          </div>
          {tab === 'AI Analytics' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <input className="rounded border px-2 py-1 text-sm bg-white dark:bg-slate-900" placeholder="Search user…" value={logFilters.q} onChange={e=>setLogFilters(f=>({...f,q:e.target.value}))} />
                <input className="rounded border px-2 py-1 text-sm bg-white dark:bg-slate-900" placeholder="Endpoint" value={logFilters.endpoint} onChange={e=>setLogFilters(f=>({...f,endpoint:e.target.value}))} />
                <select className="rounded border px-2 py-1 text-sm bg-white dark:bg-slate-900" value={logFilters.status} onChange={e=>setLogFilters(f=>({...f,status:e.target.value}))}>
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
                <input className="rounded border px-2 py-1 text-sm bg-white dark:bg-slate-900" placeholder="Model" value={logFilters.model} onChange={e=>setLogFilters(f=>({...f,model:e.target.value}))} />
              </div>
              <div className="overflow-auto text-xs max-h-[36vh]">
                <table className="min-w-full border bg-slate-50 dark:bg-slate-900">
                  <thead>
                    <tr>
                      <th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Role</th><th className="p-2">Endpoint</th><th className="p-2">Status</th><th className="p-2">Req/Resp</th><th className="p-2">Tokens</th><th className="p-2">Err</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log=>
                      <tr key={log._id} className={log.status==='error'?"bg-rose-50 dark:bg-rose-950/40":""}>
                        <td className="p-2 whitespace-nowrap">{log.timestamp && new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-2">{log.userName}</td>
                        <td className="p-2">{log.role}</td>
                        <td className="p-2">{log.endpoint}</td>
                        <td className={"p-2 "+(log.status==='error'?'text-rose-500 font-bold':'text-emerald-600')}>{log.status}</td>
                        <td className="p-2 max-w-[10vw] truncate" title={log.request + '\n' + log.response}>{(log.request||'').slice(0,80)}…</td>
                        <td className="p-2">{log.tokens||''}</td>
                        <td className="p-2 text-rose-800">{log.error||''}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {!logs.length && <div className="text-slate-400 p-6 text-center">No logs found.</div>}
              </div>
            </div>
          )}
          {tab === 'Issue Reports' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <select className="rounded border px-2 py-1 text-sm bg-white dark:bg-slate-900" value={reportFilters.status} onChange={e=>setReportFilters(f=>({...f,status:e.target.value}))}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
                <input className="rounded border px-2 py-1 text-sm bg-white dark:bg-slate-900" placeholder="Search user…" value={reportFilters.q} onChange={e=>setReportFilters(f=>({...f,q:e.target.value}))} />
              </div>
              <div className="overflow-auto text-xs max-h-[36vh]">
                <table className="min-w-full border bg-slate-50 dark:bg-slate-900">
                  <thead>
                    <tr>
                      <th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Panel</th><th className="p-2">Section</th><th className="p-2">Summary</th><th className="p-2">Status</th><th className="p-2">Admin Response</th><th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r=>(
                      <tr key={r._id}>
                        <td className="p-2 whitespace-nowrap">{r.createdAt&&new Date(r.createdAt).toLocaleString()}</td>
                        <td className="p-2">{r.userName}</td>
                        <td className="p-2">{r.panel}</td>
                        <td className="p-2">{r.section}</td>
                        <td className="p-2 max-w-[12vw] truncate" title={r.summary}>{r.summary}</td>
                        <td className={"p-2 "+(r.status==='closed'?'text-emerald-600 font-bold':'text-rose-600')}>{r.status}</td>
                        <td className="p-2">{r.adminResponse||'-'}</td>
                        <td className="p-2">
                          {r.status==='open'&&<button className="rounded bg-indigo-600 px-2 py-1 text-xs text-white" onClick={()=>setResponding(r)}>Reply</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!reports.length && <div className="text-slate-400 p-6 text-center">No reports found.</div>}
              </div>
              {/* Respond modal */}
              {responding && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
                  <div className="rounded-xl bg-white p-8 shadow-xl dark:bg-slate-900 w-full max-w-md">
                    <h3 className="mb-2 text-lg font-semibold">Respond to Report</h3>
                    <p className="mb-2 text-sm text-slate-600">{responding.summary}</p>
                    <textarea className="w-full rounded border px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 mb-2" rows={4} value={responseMsg} onChange={e=>setResponseMsg(e.target.value)} placeholder="Type response…" />
                    <div className="flex gap-3">
                      <button className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={async()=>{
                        await apiFetch(`/api/admin/reports/${responding._id}/respond`,{method:'POST',body:{response:responseMsg}})
                        setResponding(null); setResponseMsg(''); setReportFilters(f=>({...f})) /*force reload*/
                      }}>Submit</button>
                      <button className="rounded border px-4 py-2" onClick={()=>setResponding(null)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'User Management' && (
            <UserManagement />
          )}
          {tab === 'Bulk Upload' && (
            <BulkUpload />
          )}
          {tab === 'Question Bank' && (
            <QuestionBank />
          )}
          {tab === 'Assessment Reports' && (
            <AssessmentReports />
          )} 
        </PageContainer>
      </main>
    </div>
  )
}

function StatTile({ label, value, accent }) {
  const bg = {
    indigo: "from-indigo-100 via-indigo-50 to-white dark:from-indigo-800 dark:via-slate-900",
    emerald: "from-emerald-100 via-emerald-50 to-white dark:from-emerald-800 dark:via-slate-900",
    blue: "from-blue-100 via-blue-50 to-white dark:from-blue-800 dark:via-slate-900",
    rose: "from-rose-100 via-rose-50 to-white dark:from-rose-800 dark:via-slate-900"
  }[accent];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${bg} p-3 shadow-xl text-center`}>
      <div className="text-xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  )
}
