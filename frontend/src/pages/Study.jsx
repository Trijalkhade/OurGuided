import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../context/AuthContext';
import { useGrowth } from '../context/GrowthContext';
import toast from 'react-hot-toast';
import { FiClock, FiActivity, FiRefreshCw, FiSquare, FiTrendingUp, FiZap, FiAward, FiBarChart2 } from 'react-icons/fi';
import * as cache from '../utils/cache';
import { SkelStudy } from '../components/Skeleton.jsx';
import '../styles/analytics.css';

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

const KnowledgeLineChart = ({ data, year }) => {
  const [hoverPoint, setHoverPoint] = useState(null);
  
  if (!data || !data.monthly) return null;
  const monthly = data.monthly;
  const W = 620, H = 260, PL = 52, PR = 20, PT = 24, PB = 42;
  const innerW = W - PL - PR, innerH = H - PT - PB;
  
  const getCSSVar = (name) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || '#3b5bfa';
  };
  
  const chartPrimary = getCSSVar('--chart-primary');
  const chartSecondary = getCSSVar('--chart-secondary');
  const chartGrid = getCSSVar('--chart-grid');
  const chartText = getCSSVar('--chart-text');
  
  const maxK = Math.max(...monthly.map(m => m.cumulative), 1);
  const getX = (m, dFrac = 1) => PL + ((m + dFrac) / 12) * innerW;
  const getY = (v) => PT + innerH - (v / maxK) * innerH;

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
    const prev = m > 0 ? monthly[m - 1].cumulative : 0;
    const approxCum = prev + (monthly[m].knowledge * dFrac);
    return { x: getX(m, dFrac), y: getY(approxCum), knowledge: parseFloat(d.knowledge), date: d.date };
  });

  return (
    <div style={{ position: 'relative', overflowX: 'auto', padding: '1rem 0' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 400, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="kGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartPrimary} stopOpacity="0.4"/>
            <stop offset="100%" stopColor={chartSecondary} stopOpacity="0"/>
          </linearGradient>
        </defs>
        
        {/* Y-Axis Grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke={chartGrid} strokeWidth="1" strokeDasharray="4 3"/>
            <text x={PL - 10} y={t.y + 4} textAnchor="end" fontSize="10" fill={chartText} fontFamily="var(--mono)">{fmtK(t.val)}</text>
          </g>
        ))}
        
        {/* Current Month Indicator */}
        <line x1={getX(curMonthIdx)} y1={PT} x2={getX(curMonthIdx)} y2={PT + innerH} stroke={chartPrimary} strokeWidth="1" strokeDasharray="4 3" opacity="0.4"/>
        
        {/* Area & Line */}
        <path d={areaD} fill="url(#kGrad)"/>
        <path d={pathData} fill="none" stroke={chartPrimary} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        
        {/* Daily Dots */}
        {dailyDots.map((d, i) => (
          <circle key={`d-${i}`} cx={d.x} cy={d.y} r="3" fill={chartSecondary} opacity="0.6"
            onMouseEnter={() => setHoverPoint({ type: 'daily', x: d.x, y: d.y, val: `+${fmt(d.knowledge)}`, date: d.date })}
            onMouseLeave={() => setHoverPoint(null)}
            style={{ cursor: 'pointer', transition: 'r 0.2s' }}
          />
        ))}
        
        {/* Monthly Dots */}
        {monthly.map((m, i) => {
          const isHovered = hoverPoint?.type === 'monthly' && hoverPoint?.index === i;
          return (
            <g key={`m-${i}`} 
               onMouseEnter={() => setHoverPoint({ type: 'monthly', index: i, x: getX(i), y: getY(m.cumulative), val: fmt(m.cumulative), label: m.label, gained: fmt(m.knowledge) })}
               onMouseLeave={() => setHoverPoint(null)}
               style={{ cursor: 'pointer' }}>
              <circle cx={getX(i)} cy={getY(m.cumulative)} r={isHovered ? "7" : "5"}
                fill="var(--bg)" stroke={chartPrimary} strokeWidth={isHovered ? "3" : "2"}
                style={{ transition: 'all 0.2s' }} />
              <circle cx={getX(i)} cy={getY(m.cumulative)} r="15" fill="transparent" />
            </g>
          );
        })}
        
        {/* X-Axis Labels */}
        {monthly.map((m, i) => (
          <text key={`l-${i}`} x={getX(i - 0.5)} y={H - 10} textAnchor="middle" fontSize="10" fill={chartText} fontFamily="var(--mono)" fontWeight={i === curMonthIdx ? 'bold' : 'normal'}>{m.label}</text>
        ))}
        
        {/* Axes Base Lines */}
        <line x1={PL} y1={PT} x2={PL} y2={PT + innerH} stroke={chartGrid} strokeWidth="1.5"/>
        <line x1={PL} y1={PT + innerH} x2={W - PR} y2={PT + innerH} stroke={chartGrid} strokeWidth="1.5"/>
      </svg>
      
      {/* Interactive Tooltip Overlay */}
      {hoverPoint && (
        <div style={{
          position: 'absolute',
          left: `calc(${(hoverPoint.x / W) * 100}%)`,
          top: `calc(${(hoverPoint.y / H) * 100}%)`,
          transform: `translate(${hoverPoint.x > W * 0.8 ? '-90%' : hoverPoint.x < W * 0.2 ? '-10%' : '-50%'}, calc(-100% - 12px))`,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          padding: '0.5rem 0.75rem',
          boxShadow: 'var(--shadow)',
          pointerEvents: 'none',
          zIndex: 10,
          minWidth: '100px',
          textAlign: 'center'
        }}>
          {hoverPoint.type === 'monthly' ? (
            <>
              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>{hoverPoint.label} {year}</div>
              <div style={{ fontSize: '1.1rem', color: 'var(--text)', fontWeight: '800', fontFamily: 'var(--mono)' }}>{hoverPoint.val} pts</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '2px', fontWeight: '600' }}>+{hoverPoint.gained} gained</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '2px' }}>{hoverPoint.date}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--accent2)', fontWeight: 'bold' }}>{hoverPoint.val} pts</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const UsageTracker = () => {
  const { handleGrowthAward } = useGrowth();
  const cachedStatus   = cache.get('study:status');
  const cachedSessions = cache.get('study:sessions');
  const cachedChart    = cache.get('study:chart:' + new Date().getFullYear());

  const hasCachedData = cachedStatus !== null;

  const [status,    setStatus]    = useState(cachedStatus ? cachedStatus.data : null);
  const [sessions,  setSessions]  = useState(cachedSessions ? cachedSessions.data : []);
  const [chart,     setChart]     = useState(cachedChart ? cachedChart.data : null);
  const [elapsed,   setElapsed]   = useState(0);
  const [loading,   setLoading]   = useState(!hasCachedData);
  const [actLoad,   setActLoad]   = useState(false);
  const tickRef = useRef(null);

  const startTick = useCallback((startTime) => {
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    }, 1000);
  }, []);
  const stopTick = useCallback(() => { clearInterval(tickRef.current); setElapsed(0); }, []);

  const fetchAll = useCallback(async (silent = false) => {
    try {
      const year = new Date().getFullYear();
      const results = await Promise.allSettled([
        API.get('/study/status'),
        API.get('/study/sessions'),
        API.get(`/recommendations/knowledge-chart?year=${year}`),
      ]);
      const [stRes, sessRes, chartRes] = results;
      if (stRes.status === 'fulfilled') {
        setStatus(stRes.value.data);
        cache.set('study:status', stRes.value.data, 'study_status');
        if (stRes.value.data.active_session) startTick(stRes.value.data.active_session.start_time);
        else stopTick();
      }
      if (sessRes.status === 'fulfilled') {
        setSessions(sessRes.value.data);
        cache.set('study:sessions', sessRes.value.data, 'study_chart');
      }
      if (chartRes.status === 'fulfilled') {
        setChart(chartRes.value.data);
        cache.set(`study:chart:${year}`, chartRes.value.data, 'study_chart');
      }
    } catch { if (!silent) toast.error('Failed to load analytics data'); }
    finally  { setLoading(false); }
  }, [startTick, stopTick]);

  useEffect(() => {
    if (hasCachedData) {
      if (cachedStatus?.data?.active_session) startTick(cachedStatus.data.active_session.start_time);
      fetchAll(true);
    } else {
      fetchAll();
    }
    return () => clearInterval(tickRef.current);
  }, [fetchAll, hasCachedData, cachedStatus]);

  const handleStop = async () => {
    setActLoad(true);
    try {
      const { data } = await API.post('/study/stop');
      toast.success('Session ended. Metrics recorded.');
      if (data?.growth) {
        handleGrowthAward(data.growth);
      }
      cache.invalidatePrefix('study');
      await fetchAll(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to stop session'); }
    finally { setActLoad(false); }
  };

  if (loading) return <SkelStudy />;

  const isActive = !!status?.active_session;
  const year = new Date().getFullYear();
  const totalYearK = chart?.monthly?.reduce((s, m) => s + m.knowledge, 0) || 0;
  const totalYearHours = chart?.monthly?.reduce((s, m) => s + parseFloat(m.hours || 0), 0) || 0;
  const bestMonth = chart?.monthly?.reduce((b, m) => m.knowledge > (b?.knowledge || 0) ? m : b, null);
  
  // Calculate total sessions for the year
  const totalYearSessions = chart?.monthly?.reduce((s, m) => s + (m.sessions || 0), 0) || 0;

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div className="analytics-title">
          <h2>Growth Analytics</h2>
          <p>Executive performance metrics and cumulative knowledge trajectory.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isActive && (
            <div className="analytics-live-widget">
              <div className="live-indicator">
                <div className="live-dot"></div>
                LIVE SESSION
              </div>
              <div className="live-time">{formatDuration(elapsed)}</div>
              <button 
                className="btn btn-danger btn-sm" 
                onClick={handleStop} 
                disabled={actLoad}
                style={{ padding: '0.35rem 0.8rem', marginLeft: '0.5rem' }}
              >
                {actLoad ? 'Stopping...' : 'End'}
              </button>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => fetchAll()} title="Refresh Data">
            <FiRefreshCw size={16}/>
          </button>
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap"><FiAward /></div>
          <div className="kpi-content">
            <div className="kpi-label">YTD Knowledge Index</div>
            <div className="kpi-value">{fmtK(totalYearK)}</div>
            {bestMonth?.knowledge > 0 && (
              <div className="kpi-sub">
                <FiTrendingUp /> Peak: {bestMonth.label} (+{fmtK(bestMonth.knowledge)})
              </div>
            )}
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-icon-wrap"><FiClock /></div>
          <div className="kpi-content">
            <div className="kpi-label">YTD Active Hours</div>
            <div className="kpi-value">{fmt(totalYearHours, 1)}h</div>
            <div className="kpi-sub" style={{ color: 'var(--text3)' }}>
               Cumulative engagement
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap"><FiActivity /></div>
          <div className="kpi-content">
            <div className="kpi-label">YTD Sessions</div>
            <div className="kpi-value">{totalYearSessions}</div>
            <div className="kpi-sub" style={{ color: 'var(--text3)' }}>
               Total tracked logins
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-main-grid">
        <div className="analytics-main-col" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="analytics-panel">
            <div className="analytics-panel-title">
              <FiBarChart2 /> Cumulative Trajectory ({year})
            </div>
            {totalYearK === 0 ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text3)' }}>
                <FiTrendingUp size={32} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                <h4>No data available</h4>
                <p style={{ fontSize: '0.85rem' }}>Your growth curve will appear here once you begin studying.</p>
              </div>
            ) : (
              <KnowledgeLineChart data={chart} year={year}/>
            )}
          </div>

          {chart?.monthly && totalYearK > 0 && (
            <div className="analytics-panel">
              <div className="analytics-panel-title">
                <FiZap /> Monthly Performance Index
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Active Hours</th>
                      <th>Sessions</th>
                      <th>Knowledge Gained</th>
                      <th>Cumulative Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.monthly.map((m, i) => (
                      <tr key={i} style={{ background: i === new Date().getMonth() ? 'var(--accentbg)' : 'transparent' }}>
                        <td style={{ fontWeight: 600 }}>{m.label}</td>
                        <td className="data-mono">{fmt(m.hours)}h</td>
                        <td className="data-mono">{m.sessions}</td>
                        <td className="data-mono">
                          <span style={{ color: m.knowledge > 0 ? 'var(--success)' : 'inherit' }}>
                            {m.knowledge > 0 ? '+' : ''}{fmtK(m.knowledge)}
                          </span>
                        </td>
                        <td className="data-highlight">{fmtK(m.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="analytics-side-col">
          <div className="analytics-panel" style={{ height: '100%' }}>
            <div className="analytics-panel-title">
              <FiClock /> Session Ledger
            </div>
            {sessions.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text3)' }}>
                <p style={{ fontSize: '0.85rem' }}>No recent sessions recorded.</p>
              </div>
            ) : (
              <div className="session-timeline">
                {sessions.map(s => (
                  <div key={s.session_id} className="session-item">
                    <div>
                      <div className="session-date">
                        {new Date(s.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="session-time">
                        {new Date(s.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {new Date(s.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="session-stats">
                      <div className="session-gained">+{fmtK(s.knowledge_gained)} pts</div>
                      <div className="session-duration">{fmt(s.hours_studied)}h</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageTracker;
