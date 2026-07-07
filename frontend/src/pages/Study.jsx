import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API } from '../context/AuthContext';
import { useGrowth } from '../context/GrowthContext';
import toast from 'react-hot-toast';
import {
  FiClock, FiActivity, FiRefreshCw, FiSquare, FiTrendingUp,
  FiZap, FiAward, FiBarChart2, FiMaximize2, FiMinimize2, FiCalendar
} from 'react-icons/fi';
import * as cache from '../utils/cache';
import { SkelStudy } from '../components/Skeleton.jsx';
import '../styles/analytics.css';

/* ── Formatters ───────────────────────────────────────────────── */
const fmt  = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtK = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
  if (v >= 1000)  return (v / 1000).toFixed(2) + 'k';
  return v.toFixed(2);
};
const formatDuration = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return [h > 0 ? String(h).padStart(2,'0') : null, String(m).padStart(2,'0'), String(sec).padStart(2,'0')]
    .filter(Boolean).join(':');
};

/* ── CSS Variable Reader ──────────────────────────────────────── */
const getCSSVar = (name) => {
  if (typeof window === 'undefined') return '#C8102E';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#C8102E';
};

/* ══════════════════════════════════════════════════════════════════
   AWS-INSPIRED KNOWLEDGE CHART
   Features:
   - Crosshair cursor with vertical tracking line
   - Dual data series (cumulative line + monthly bars)
   - Legend with live statistics
   - Toolbar with view toggles
   - Inline stat annotations (min/max/avg)
   ══════════════════════════════════════════════════════════════════ */
const KnowledgeChart = ({ data, year }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const lineRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [viewMode, setViewMode] = useState('area'); // 'area' | 'bars' | 'combined'
  const [expanded, setExpanded] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [lineLen, setLineLen] = useState(0);
  const [lineReady, setLineReady] = useState(false);

  if (!data || !data.monthly) return null;

  const monthly = data.monthly;
  const curMonthIdx = new Date().getMonth();

  // Chart dimensions
  const W = 700, H = expanded ? 340 : 260;
  const PL = 55, PR = 24, PT = 20, PB = 44;
  const innerW = W - PL - PR, innerH = H - PT - PB;

  // Colors
  const chartPrimary = getCSSVar('--chart-primary');
  const chartSecondary = getCSSVar('--chart-secondary');
  const chartGrid = getCSSVar('--chart-grid');
  const chartText = getCSSVar('--chart-text');
  const successColor = getCSSVar('--success');

  // Data ranges
  const maxCum = Math.max(...monthly.map(m => m.cumulative), 1);
  const maxGain = Math.max(...monthly.map(m => m.knowledge), 1);

  // Coordinate helpers
  const getX = (i) => PL + ((i + 0.5) / 12) * innerW;
  const getY = (v) => PT + innerH - (v / maxCum) * innerH;
  const getBarY = (v) => PT + innerH - (v / maxGain) * (innerH * 0.6);
  const barW = (innerW / 12) * 0.45;

  // Compute statistics
  const stats = useMemo(() => {
    const gains = monthly.map(m => m.knowledge).filter(k => k > 0);
    if (gains.length === 0) return { min: 0, max: 0, avg: 0, total: 0 };
    return {
      min: Math.min(...gains),
      max: Math.max(...gains),
      avg: gains.reduce((s,v) => s + v, 0) / gains.length,
      total: gains.reduce((s,v) => s + v, 0),
    };
  }, [monthly]);

  // Cumulative line path (smooth curve)
  const linePath = useMemo(() => {
    const pts = monthly.map((m, i) => ({ x: getX(i), y: getY(m.cumulative) }));
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
    }
    return d;
  }, [monthly, W, H]);

  // Area fill
  const areaPath = useMemo(() => {
    if (!linePath) return '';
    const firstX = getX(0);
    const lastX = getX(11);
    const baseY = PT + innerH;
    return `${linePath} L${lastX},${baseY} L${firstX},${baseY} Z`;
  }, [linePath, innerH]);

  // Y-axis ticks (cumulative)
  const yTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => {
      const p = i / count;
      return { val: maxCum * p, y: PT + innerH - p * innerH };
    });
  }, [maxCum, innerH]);

  // Measure line path length and trigger draw animation
  useEffect(() => {
    if (lineRef.current) {
      const len = lineRef.current.getTotalLength();
      setLineLen(len);
      // Small delay to let the browser paint with dashoffset = len first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setLineReady(true);
        });
      });
    }
  }, [linePath, animKey, viewMode]);

  // Mouse tracking for crosshair
  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgWidth = rect.width;
    const svgX = (mouseX / svgWidth) * W;

    // Find nearest month
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < 12; i++) {
      const dist = Math.abs(svgX - getX(i));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const m = monthly[nearestIdx];
    setHover({
      idx: nearestIdx,
      svgX: getX(nearestIdx),
      screenX: mouseX,
      screenY: e.clientY - rect.top,
      month: m,
    });
  }, [monthly, W]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  return (
    <div className="chart-panel">
      {/* ── Header Toolbar ── */}
      <div className="chart-panel-header">
        <div className="chart-panel-title">
          <FiBarChart2 size={16} />
          Cumulative Knowledge Trajectory — {year}
        </div>
        <div className="chart-toolbar">
          {['area', 'bars', 'combined'].map(mode => (
            <button
              key={mode}
              className={`chart-toolbar-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => { setViewMode(mode); setAnimKey(k => k + 1); setLineReady(false); }}
            >
              {mode === 'area' ? 'Trend' : mode === 'bars' ? 'Monthly' : 'Combined'}
            </button>
          ))}
          <button
            className="chart-toolbar-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* ── Chart Body ── */}
      <div
        className="chart-body"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartPrimary} stopOpacity="0.25" />
              <stop offset="80%" stopColor={chartPrimary} stopOpacity="0.03" />
              <stop offset="100%" stopColor={chartPrimary} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartSecondary} stopOpacity="0.85" />
              <stop offset="100%" stopColor={chartSecondary} stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {/* ── Horizontal Grid Lines ── */}
          {yTicks.map((t, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={PL} y1={t.y} x2={W - PR} y2={t.y}
                stroke={chartGrid} strokeWidth="1" opacity="0.6"
              />
              <text
                x={PL - 8} y={t.y + 4}
                textAnchor="end" fontSize="9.5" fill={chartText}
                fontFamily="var(--mono)"
              >
                {fmtK(t.val)}
              </text>
            </g>
          ))}

          {/* ── X-Axis Labels ── */}
          {monthly.map((m, i) => (
            <text
              key={`xl-${i}`}
              x={getX(i)} y={H - 8}
              textAnchor="middle" fontSize="9.5"
              fill={i === curMonthIdx ? chartPrimary : chartText}
              fontFamily="var(--mono)"
              fontWeight={i === curMonthIdx ? '700' : '400'}
            >
              {m.label}
            </text>
          ))}

          {/* ── Axes ── */}
          <line x1={PL} y1={PT} x2={PL} y2={PT + innerH} stroke={chartGrid} strokeWidth="1" />
          <line x1={PL} y1={PT + innerH} x2={W - PR} y2={PT + innerH} stroke={chartGrid} strokeWidth="1" />

          {/* ── Monthly Gain Bars ── */}
          {(viewMode === 'bars' || viewMode === 'combined') && monthly.map((m, i) => {
            const barH = PT + innerH - getBarY(m.knowledge);
            return (
              <rect
                key={`bar-${i}-${animKey}`}
                x={getX(i) - barW / 2}
                y={getBarY(m.knowledge)}
                width={barW}
                height={barH}
                fill="url(#barGrad)"
                rx="3"
                opacity={hover?.idx === i ? 1 : 0.7}
                style={{
                  transformOrigin: `${getX(i)}px ${PT + innerH}px`,
                  animation: `barGrow 1.5s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.06}s both`,
                  transition: 'opacity 0.15s',
                }}
              />
            );
          })}

          {/* ── Cumulative Area Fill ── */}
          {(viewMode === 'area' || viewMode === 'combined') && areaPath && (
            <path
              key={`area-${animKey}`}
              d={areaPath} fill="url(#areaGrad)"
              style={{ animation: 'areaFadeIn 0.8s ease 0.6s both' }}
            />
          )}

          {/* ── Cumulative Line (animated draw) ── */}
          {(viewMode === 'area' || viewMode === 'combined') && linePath && (
            <path
              key={`line-${animKey}`}
              ref={lineRef}
              d={linePath} fill="none"
              stroke={chartPrimary} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={lineLen || 2000}
              strokeDashoffset={lineReady ? 0 : (lineLen || 2000)}
              style={{ transition: lineReady ? 'stroke-dashoffset 1.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'none' }}
            />
          )}

          {/* ── Monthly Dots on Line ── */}
          {(viewMode === 'area' || viewMode === 'combined') && monthly.map((m, i) => (
            <circle
              key={`dot-${i}-${animKey}`}
              cx={getX(i)} cy={getY(m.cumulative)}
              r={hover?.idx === i ? 5 : 3}
              fill={hover?.idx === i ? chartPrimary : 'var(--card)'}
              stroke={chartPrimary} strokeWidth="2"
              style={{
                transformOrigin: `${getX(i)}px ${getY(m.cumulative)}px`,
                animation: `dotGrow 0.3s ease ${0.3 + i * 0.1}s both`,
                transition: 'r 0.15s, fill 0.15s',
              }}
            />
          ))}

          {/* ── Current Month Marker ── */}
          <line
            x1={getX(curMonthIdx)} y1={PT}
            x2={getX(curMonthIdx)} y2={PT + innerH}
            stroke={chartPrimary} strokeWidth="1"
            strokeDasharray="3 3" opacity="0.3"
          />

          {/* ── Crosshair Vertical Line ── */}
          {hover && (
            <line
              x1={hover.svgX} y1={PT}
              x2={hover.svgX} y2={PT + innerH}
              stroke={chartPrimary} strokeWidth="1"
              opacity="0.5"
            />
          )}

          {/* ── Statistics Annotations (Min / Max markers) ── */}
          {(viewMode === 'area' || viewMode === 'combined') && stats.max > 0 && (() => {
            const maxIdx = monthly.findIndex(m => m.cumulative === maxCum);
            if (maxIdx < 0) return null;
            return (
              <g>
                <line
                  x1={getX(maxIdx) - 20} y1={getY(maxCum)}
                  x2={getX(maxIdx) + 20} y2={getY(maxCum)}
                  stroke={successColor} strokeWidth="1" strokeDasharray="4 2" opacity="0.5"
                />
                <text
                  x={getX(maxIdx) + 24} y={getY(maxCum) + 3}
                  fontSize="8.5" fill={successColor} fontFamily="var(--mono)" fontWeight="700"
                >
                  max {fmtK(maxCum)}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* ── Crosshair Tooltip ── */}
        {hover && (
          <div
            className="chart-crosshair-tooltip"
            style={{
              left: hover.screenX > (containerRef.current?.clientWidth || 0) * 0.7
                ? hover.screenX - 170
                : hover.screenX + 16,
              top: 10,
            }}
          >
            <div className="crosshair-title">{hover.month.label} {year}</div>
            {(viewMode === 'area' || viewMode === 'combined') && (
              <div className="crosshair-row">
                <span className="crosshair-metric-label">
                  <span className="crosshair-metric-swatch" style={{ background: chartPrimary }} />
                  Cumulative
                </span>
                <span className="crosshair-metric-val">{fmtK(hover.month.cumulative)}</span>
              </div>
            )}
            <div className="crosshair-row">
              <span className="crosshair-metric-label">
                <span className="crosshair-metric-swatch" style={{ background: chartSecondary }} />
                Gained
              </span>
              <span className="crosshair-metric-val" style={{ color: hover.month.knowledge > 0 ? successColor : 'inherit' }}>
                {hover.month.knowledge > 0 ? '+' : ''}{fmtK(hover.month.knowledge)}
              </span>
            </div>
            <div className="crosshair-row">
              <span className="crosshair-metric-label">Hours</span>
              <span className="crosshair-metric-val">{fmt(hover.month.hours, 1)}h</span>
            </div>
            <div className="crosshair-row">
              <span className="crosshair-metric-label">Sessions</span>
              <span className="crosshair-metric-val">{hover.month.sessions || 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Legend + Statistics ── */}
      <div className="chart-legend">
        {(viewMode === 'area' || viewMode === 'combined') && (
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: chartPrimary }} />
            <span className="legend-label">Cumulative</span>
            <span className="legend-stat">{fmtK(stats.total)} total</span>
          </div>
        )}
        {(viewMode === 'bars' || viewMode === 'combined') && (
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: chartSecondary, height: 6, borderRadius: 2 }} />
            <span className="legend-label">Monthly Gain</span>
          </div>
        )}
        <div className="legend-item" style={{ marginLeft: 'auto' }}>
          <span className="legend-label" style={{ color: getCSSVar('--text3') }}>
            avg: <strong style={{ color: getCSSVar('--text') }}>{fmtK(stats.avg)}</strong>
            {' · '}min: <strong style={{ color: getCSSVar('--text') }}>{fmtK(stats.min)}</strong>
            {' · '}max: <strong style={{ color: getCSSVar('--text') }}>{fmtK(stats.max)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const UsageTracker = () => {
  const { handleGrowthAward } = useGrowth();
  const cachedStatus   = cache.get('study:status');
  const cachedSessions = cache.get('study:sessions');
  const cachedChart    = cache.get('study:chart:' + new Date().getFullYear());

  const hasCachedData = cachedStatus !== null;

  const [status,   setStatus]   = useState(cachedStatus ? cachedStatus.data : null);
  const [sessions, setSessions] = useState(cachedSessions ? cachedSessions.data : []);
  const [chart,    setChart]    = useState(cachedChart ? cachedChart.data : null);
  const [elapsed,  setElapsed]  = useState(0);
  const [loading,  setLoading]  = useState(!hasCachedData);
  const [actLoad,  setActLoad]  = useState(false);
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
  }, [fetchAll]);

  const handleStop = async () => {
    setActLoad(true);
    try {
      const { data } = await API.post('/study/stop');
      toast.success('Session ended. Metrics recorded.');
      if (data?.growth) handleGrowthAward(data.growth);
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
  const totalYearSessions = chart?.monthly?.reduce((s, m) => s + (m.sessions || 0), 0) || 0;
  const bestMonth = chart?.monthly?.reduce((b, m) => m.knowledge > (b?.knowledge || 0) ? m : b, null);
  const maxMonthlyGain = chart?.monthly ? Math.max(...chart.monthly.map(m => m.knowledge)) : 0;

  // Avg session length
  const avgSessionH = totalYearSessions > 0 ? (totalYearHours / totalYearSessions) : 0;

  return (
    <div className="analytics-dashboard">
      {/* ── Header ── */}
      <div className="analytics-header">
        <div className="analytics-title">
          <h2>Growth Analytics</h2>
          <p>Performance metrics and cumulative knowledge trajectory.</p>
        </div>
        <div className="analytics-header-actions">
          {isActive && (
            <div className="analytics-live-widget">
              <div className="live-indicator">
                <div className="live-dot" />
                LIVE
              </div>
              <div className="live-time">{formatDuration(elapsed)}</div>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleStop}
                disabled={actLoad}
                style={{ padding: '0.3rem 0.7rem' }}
              >
                <FiSquare size={11} /> {actLoad ? '...' : 'End'}
              </button>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => fetchAll()} title="Refresh Data" style={{ width: 'auto' }}>
            <FiRefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="analytics-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">YTD Knowledge</div>
          <div className="kpi-value">{fmtK(totalYearK)}</div>
          {bestMonth?.knowledge > 0 && (
            <div className="kpi-sub">
              <FiTrendingUp size={12} /> Peak: {bestMonth.label} (+{fmtK(bestMonth.knowledge)})
            </div>
          )}
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Hours</div>
          <div className="kpi-value">{fmt(totalYearHours, 1)}h</div>
          <div className="kpi-sub" style={{ color: 'var(--text3)' }}>
            <FiClock size={12} /> Cumulative {year}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Sessions</div>
          <div className="kpi-value">{totalYearSessions}</div>
          <div className="kpi-sub" style={{ color: 'var(--text3)' }}>
            <FiActivity size={12} /> Tracked logins
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Session</div>
          <div className="kpi-value">{fmt(avgSessionH, 1)}h</div>
          <div className="kpi-sub" style={{ color: 'var(--text3)' }}>
            <FiCalendar size={12} /> Per login
          </div>
        </div>
      </div>

      {/* ── Main Chart ── */}
      {totalYearK === 0 ? (
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div className="chart-panel-title"><FiBarChart2 size={16} /> Cumulative Trajectory ({year})</div>
          </div>
          <div className="analytics-empty">
            <FiTrendingUp size={36} />
            <h4>No data available for {year}</h4>
            <p>Your growth trajectory will render here once you begin studying.</p>
          </div>
        </div>
      ) : (
        <KnowledgeChart data={chart} year={year} />
      )}

      {/* ── Bottom Grid: Table + Sessions ── */}
      <div className="analytics-main-grid">
        {/* Monthly Performance Table */}
        <div className="analytics-main-col">
          {chart?.monthly && totalYearK > 0 && (
            <div className="analytics-panel">
              <div className="analytics-panel-header">
                <div className="analytics-panel-title"><FiZap size={16} /> Monthly Performance Index</div>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Hours</th>
                      <th>Sessions</th>
                      <th>Knowledge Gained</th>
                      <th>Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.monthly.map((m, i) => (
                      <tr key={i} className={i === new Date().getMonth() ? 'current-row' : ''}>
                        <td style={{ fontWeight: 600 }}>{m.label}</td>
                        <td className="data-mono">{fmt(m.hours, 1)}h</td>
                        <td className="data-mono">{m.sessions}</td>
                        <td>
                          <div className="table-bar-cell">
                            <span className={`data-mono ${m.knowledge > 0 ? 'data-positive' : ''}`}>
                              {m.knowledge > 0 ? '+' : ''}{fmtK(m.knowledge)}
                            </span>
                            {maxMonthlyGain > 0 && (
                              <span
                                className="table-bar"
                                style={{ width: `${Math.max((m.knowledge / maxMonthlyGain) * 60, 0)}px` }}
                              />
                            )}
                          </div>
                        </td>
                        <td className="data-mono data-highlight">{fmtK(m.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Session Ledger */}
        <div className="analytics-side-col">
          <div className="analytics-panel" style={{ height: '100%' }}>
            <div className="analytics-panel-header">
              <div className="analytics-panel-title"><FiClock size={16} /> Session Ledger</div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                {sessions.length} entries
              </span>
            </div>
            {sessions.length === 0 ? (
              <div className="analytics-empty" style={{ padding: '2rem 1rem' }}>
                <p style={{ fontSize: '0.82rem' }}>No recent sessions recorded.</p>
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
                      <div className="session-duration">{fmt(s.hours_studied, 1)}h</div>
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
