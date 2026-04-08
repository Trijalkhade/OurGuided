import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiClock, FiBarChart2, FiRefreshCw, FiSquare, FiTrendingUp, FiZap, FiAward } from 'react-icons/fi';

const fmt  = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtK = (n) => {
  const v = parseFloat(n || 0);
  return v >= 1000 ? (v / 1000).toFixed(2) + 'k' : v.toFixed(2);
};
const formatDuration = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return [h > 0 ? String(h).padStart(2,'0') : null, String(m).padStart(2,'0'), String(sec).padStart(2,'0')]
    .filter(Boolean).join(':');
};
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const HistoryBar = ({ history }) => {
  if (!history.length) return null;
  const max    = Math.max(...history.map(d => parseFloat(d.total_hours) || 0), 0.1);
  const recent = [...history].reverse().slice(-14);
  return (
    <div className="usage-history-chart">
      {recent.map((d, i) => {
        const pct = Math.round((parseFloat(d.total_hours) / max) * 100);
        return (
          <div key={i} className="bar-col" title={`${formatDate(d.session_date)}: ${fmt(d.total_hours)}h`}>
            <div className="bar-fill" style={{ height: `${Math.max(pct, 3)}%` }} />
            <div className="bar-label">{formatDate(d.session_date).split(' ')[0].slice(0, 3)}</div>
          </div>
        );
      })}
    </div>
  );
};

const KnowledgeLineChart = ({ data, year }) => {
  if (!data || !data.monthly) return null;
  const monthly = data.monthly;
  const W = 620, H = 240, PL = 52, PR = 20, PT = 18, PB = 42;
  const innerW = W - PL - PR, innerH = H - PT - PB;
  
  const maxK = Math.max(...monthly.map(m => m.cumulative), 1);
  
  // Scale x from 0 to 12. 0 is start of Jan, 12 is end of Dec.
  const getX = (m, dFrac = 1) => PL + ((m + dFrac) / 12) * innerW;
  const getY = (v) => PT + innerH - (v / maxK) * innerH;

  // Monthly nodes represent the END of each month
  const pathData = monthly.reduce((acc, m, i) => {
    const x = getX(i);
    const y = getY(m.cumulative);
    return acc + (i === 0 ? `M${getX(-0.2)},${innerH + PT} L${getX(0,0)},${innerH + PT} L${x},${y}` : ` L${x},${y}`);
  }, "");

  const areaD = `${pathData} L${getX(11)},${PT + innerH} L${getX(0,0)},${PT + innerH} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ val: maxK * p, y: PT + innerH - p * innerH }));
  const curMonthIdx = new Date().getMonth();

  const dailyDots = (data.daily || []).map(d => {
    const date = new Date(d.date);
    const m = date.getMonth();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const dFrac = date.getDate() / daysInMonth;
    
    // Find approximate cumulative at this day to place dot on the line
    const prev = m > 0 ? monthly[m - 1].cumulative : 0;
    const approxCum = prev + (monthly[m].knowledge * dFrac);
    
    return { x: getX(m, dFrac), y: getY(approxCum), knowledge: parseFloat(d.knowledge), date: d.date };
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 300, display: 'block' }}>
        <defs>
          <linearGradient id="kGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b5bfa" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="#dde2ef" strokeWidth="1" strokeDasharray="4 3"/>
            <text x={PL - 5} y={t.y + 4} textAnchor="end" fontSize="9" fill="#8892b5" fontFamily="monospace">{fmtK(t.val)}</text>
          </g>
        ))}
        <line x1={getX(curMonthIdx)} y1={PT} x2={getX(curMonthIdx)} y2={PT + innerH}
          stroke="#3b5bfa" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"/>
        <path d={areaD} fill="url(#kGrad)"/>
        <path d={pathData} fill="none" stroke="#3b5bfa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {dailyDots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="3" fill="#06b6d4" opacity="0.7">
            <title>{d.date}: +{fmt(d.knowledge)} pts</title>
          </circle>
        ))}
        {monthly.map((m, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(m.cumulative)} r="5"
              fill="white" stroke="#3b5bfa" strokeWidth="2.5">
              <title>{m.label} {year}: {fmt(m.cumulative)} cum pts</title>
            </circle>
          </g>
        ))}
        {monthly.map((m, i) => (
          <text key={i} x={getX(i - 0.5)} y={H - 8} textAnchor="middle" fontSize="9" fill="#8892b5" fontFamily="monospace">{m.label}</text>
        ))}
        <line x1={PL} y1={PT} x2={PL} y2={PT + innerH} stroke="#dde2ef" strokeWidth="1.5"/>
        <line x1={PL} y1={PT + innerH} x2={W - PR} y2={PT + innerH} stroke="#dde2ef" strokeWidth="1.5"/>
      </svg>
    </div>
  );
};

import { SkelStudy } from '../components/Skeleton.jsx';

const UsageTracker = () => {
  const [status,    setStatus]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const [sessions,  setSessions]  = useState([]);
  const [chart,     setChart]     = useState(null);
  const [elapsed,   setElapsed]   = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [actLoad,   setActLoad]   = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const tickRef = useRef(null);

  const startTick = useCallback((startTime) => {
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    }, 1000);
  }, []);
  const stopTick = useCallback(() => { clearInterval(tickRef.current); setElapsed(0); }, []);

  const fetchAll = useCallback(async () => {
    try {
      const year = new Date().getFullYear();
      const results = await Promise.allSettled([
        API.get('/study/status'),
        API.get('/study/history'),
        API.get('/study/sessions'),
        API.get(`/recommendations/knowledge-chart?year=${year}`),
      ]);
      const [stRes, histRes, sessRes, chartRes] = results;
      if (stRes.status === 'fulfilled') {
        setStatus(stRes.value.data);
        if (stRes.value.data.active_session) startTick(stRes.value.data.active_session.start_time);
        else stopTick();
      }
      if (histRes.status === 'fulfilled')  setHistory(histRes.value.data);
      if (sessRes.status === 'fulfilled')  setSessions(sessRes.value.data);
      if (chartRes.status === 'fulfilled') setChart(chartRes.value.data);
    } catch { toast.error('Failed to load usage data'); }
    finally  { setLoading(false); }
  }, [startTick, stopTick]);

  useEffect(() => {
    fetchAll();
    return () => clearInterval(tickRef.current);
  }, [fetchAll]);

  const handleStop = async () => {
    setActLoad(true);
    try {
      await API.post('/study/stop');
      toast.success('Session ended. Knowledge recorded!');
      await fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActLoad(false); }
  };

  if (loading) return <SkelStudy />;

  const { stats, today } = status || {};
  const isActive = !!status?.active_session;
  const year = new Date().getFullYear();
  const totalYearK = chart?.monthly?.reduce((s, m) => s + m.knowledge, 0) || 0;
  const bestMonth = chart?.monthly?.reduce((b, m) => m.knowledge > (b?.knowledge || 0) ? m : b, null);

  return (
    <div className="usage-page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><h2>Usage Tracker</h2><p>Real-time session tracking &amp; knowledge growth analytics</p></div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} title="Refresh" style={{ width: 'auto' }}>
          <FiRefreshCw size={14}/>
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        {['overview','annual','sessions'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className={`usage-timer-card${isActive ? ' active' : ''}`}>
            <div className="usage-timer-label">Current Session</div>
            <div className={`usage-timer-display${isActive ? '' : ' idle'}`}>
              {isActive ? formatDuration(elapsed) : '– – : – –'}
            </div>
            <div className="usage-timer-sub">
              {isActive
                ? `Started ${new Date(status.active_session.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                : 'No active session — starts automatically on login'}
            </div>
            {isActive && (
              <button className="btn btn-danger" style={{ width: 'auto', margin: '0 auto' }}
                onClick={handleStop} disabled={actLoad}>
                <FiSquare size={14}/> End Session
              </button>
            )}
          </div>

          <div className="usage-stat-grid">
            {[
              { 
                icon: '⏱️', 
                val: `${fmt((today?.hours || 0) + (isActive ? elapsed / 3600 : 0))}h`, 
                label: 'Today' 
              },
              { icon: '🧠', val: fmtK(today?.knowledge),          label: "Today's Pts" },
              { icon: '📅', val: stats?.streak_days ?? 0,         label: 'Day Streak' },
              { icon: '⚡', val: fmtK(stats?.total_knowledge),    label: 'Total Pts' },
              { icon: '🔥', val: `${fmt(stats?.multiplier||1,3)}×`, label: 'Multiplier' },
              { icon: '🎯', val: fmt(stats?.learning_core||1,2),   label: 'Learn Core' },
            ].map(({ icon, val, label }) => (
              <div key={label} className="usage-stat-card">
                <div className="usc-icon">{icon}</div>
                <div className="usc-val">{val}</div>
                <div className="usc-label">{label}</div>
              </div>
            ))}
          </div>

          {history.length > 0 && (
            <div className="usage-chart-card">
              <div className="usage-chart-title">
                <FiBarChart2 style={{ display: 'inline', marginRight: 6 }}/>
                Hours per Day — Last 14 Days
              </div>
              <HistoryBar history={history}/>
            </div>
          )}
        </>
      )}

      {activeTab === 'annual' && (
        <>
          <div className="usage-chart-card">
            <div className="usage-chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><FiTrendingUp style={{ display: 'inline', marginRight: 6 }}/>Knowledge Growth — {year}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                ● monthly &nbsp; ● daily
              </span>
            </div>
            {totalYearK === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0', height: 'auto' }}>
                <FiTrendingUp size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }}/>
                <h3>No data for {year} yet</h3>
                <p>Study to see your knowledge curve here.</p>
              </div>
            ) : (
              <KnowledgeLineChart data={chart} year={year}/>
            )}
          </div>

          {chart?.monthly && totalYearK > 0 && (
            <div className="usage-log-card">
              <div className="usage-log-title">
                <FiAward style={{ display: 'inline', marginRight: 6 }}/>Monthly Breakdown — {year}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Month','Hours','Sessions','Gained','Cumulative'].map(h => (
                        <th key={h} style={{ padding: '0.45rem 0.55rem', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.monthly.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i === new Date().getMonth() ? 'var(--accentbg)' : 'transparent' }}>
                        <td style={{ padding: '0.45rem 0.55rem', fontWeight: 600 }}>{m.label}</td>
                        <td style={{ padding: '0.45rem 0.55rem', fontFamily: 'var(--mono)' }}>{fmt(m.hours)}h</td>
                        <td style={{ padding: '0.45rem 0.55rem', fontFamily: 'var(--mono)' }}>{m.sessions}</td>
                        <td style={{ padding: '0.45rem 0.55rem', fontFamily: 'var(--mono)', color: m.knowledge > 0 ? 'var(--success)' : 'var(--text3)' }}>
                          {m.knowledge > 0 ? '+' : ''}{fmtK(m.knowledge)}
                        </td>
                        <td style={{ padding: '0.45rem 0.55rem', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmtK(m.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bestMonth?.knowledge > 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'var(--accentbg)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem', color: 'var(--accent2)' }}>
                  🏆 Best month: <strong>{bestMonth.label}</strong> — {fmtK(bestMonth.knowledge)} pts gained
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'sessions' && (
        sessions.length === 0 ? (
          <div className="empty-state">
            <FiClock size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }}/>
            <h3>No sessions yet</h3><p>Sessions start automatically when you log in.</p>
          </div>
        ) : (
          <div className="usage-log-card">
            <div className="usage-log-title"><FiClock style={{ display: 'inline', marginRight: 6 }}/>Recent Sessions</div>
            {sessions.map(s => (
              <div key={s.session_id} className="usage-log-row">
                <div className="ulr-date">
                  {new Date(s.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  <span className="ulr-time">
                    {new Date(s.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(s.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text2)' }}>{fmt(s.hours_studied)}h</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{fmtK(s.knowledge_gained)} pts</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default UsageTracker;
