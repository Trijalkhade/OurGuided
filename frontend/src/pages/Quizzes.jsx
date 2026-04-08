import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiAward, FiTrash2, FiChevronRight } from 'react-icons/fi';

/* ── Create Quiz Modal ─────────────────────────────────────────────────── */
const CreateQuizModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ title: '', description: '', category: '', difficulty: 'Beginner' });
  const [questions, setQuestions] = useState([{ question_text: '', points: 1, options: [
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
  ]}]);
  const [loading, setLoading] = useState(false);

  const CATEGORIES = ['Engineering','Business','Life Skills','Psychology','Teaching Skills','Health & Nutrition','Physical Fitness','Agriculture'];

  const addQuestion = () => setQuestions(prev => [...prev, {
    question_text: '', points: 1,
    options: [{ option_text:'',is_correct:true },{option_text:'',is_correct:false},{option_text:'',is_correct:false},{option_text:'',is_correct:false}]
  }]);

  const removeQuestion = (qi) => setQuestions(prev => prev.filter((_,i)=>i!==qi));

  const setOption = (qi, oi, key, value) => setQuestions(prev => prev.map((q,i) =>
    i === qi ? { ...q, options: q.options.map((o,j) =>
      j === oi ? { ...o, [key]: value } : (key==='is_correct' && value ? { ...o, is_correct: false } : o)
    )} : q));

  const setQuestion = (qi, key, value) => setQuestions(prev => prev.map((q,i) =>
    i === qi ? { ...q, [key]: value } : q));

  const handleSubmit = async () => {
    if (!form.title) return toast.error('Title required');
    if (questions.some(q => !q.question_text || q.options.every(o => !o.option_text)))
      return toast.error('Fill in all questions and options');
    if (questions.some(q => !q.options.some(o => o.is_correct)))
      return toast.error('Each question needs at least one correct answer');
    setLoading(true);
    try {
      await API.post('/quizzes', { ...form, questions });
      toast.success('Quiz created and published!');
      onCreated();
      onClose();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed to create quiz'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h3>Create Quiz</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX /></button>
        </div>

        <div className="form-group">
          <label>Quiz Title</label>
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Python Basics" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="What will learners gain?" />
        </div>
        <div className="two-col">
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Difficulty</label>
            <select value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})}>
              <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
            </select>
          </div>
        </div>

        <div className="divider" />
        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Questions ({questions.length})</h4>

        {questions.map((q, qi) => (
          <div key={qi} className="quiz-question-builder">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: '0.5rem' }}>
                <label>Question {qi+1}</label>
                <input value={q.question_text}
                  onChange={e => setQuestion(qi, 'question_text', e.target.value)}
                  placeholder="Enter your question..." />
              </div>
              {questions.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => removeQuestion(qi)} style={{ marginTop: '1.8rem' }}>
                  <FiTrash2 size={14} />
                </button>
              )}
            </div>
            <div className="quiz-options-grid">
              {q.options.map((opt, oi) => (
                <div key={oi} className={`quiz-option-builder ${opt.is_correct ? 'correct' : ''}`}>
                  <button className="correct-toggle" onClick={() => setOption(qi, oi, 'is_correct', true)}
                    title="Mark as correct">
                    {opt.is_correct ? <FiCheck size={14} /> : <span style={{width:14,height:14,display:'inline-block'}} />}
                  </button>
                  <input value={opt.option_text}
                    onChange={e => setOption(qi, oi, 'option_text', e.target.value)}
                    placeholder={`Option ${oi+1}`} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button className="btn btn-secondary btn-sm" onClick={addQuestion} style={{ marginBottom: '1.5rem' }}>
          <FiPlus /> Add Question
        </button>

        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Publishing…' : 'Publish Quiz'}
        </button>
      </div>
    </div>
  );
};

/* ── Take Quiz Modal ─────────────────────────────────────────────────────── */
const TakeQuizModal = ({ quiz, onClose, onCompleted }) => {
  const [answers, setAnswers]       = useState({});
  const [results, setResults]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [current, setCurrent]       = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLB, setShowLB]         = useState(false);

  const selectAnswer = (qId, optId) => setAnswers(prev => ({ ...prev, [qId]: optId }));

  const handleSubmit = async () => {
    const answered = Object.keys(answers).length;
    if (answered < quiz.questions.length)
      return toast.error(`Please answer all ${quiz.questions.length} questions`);
    setLoading(true);
    try {
      const payload = Object.entries(answers).map(([question_id, option_id]) => ({ question_id, option_id }));
      const { data } = await API.post(`/quizzes/${quiz.quiz_id}/submit`, { answers: payload });
      setResults(data);
      toast.success(`Quiz completed! You scored ${data.percentage}%`);
      onCompleted?.(data);
      // fetch leaderboard in background
      try {
        const { data: lb } = await API.get(`/quizzes/${quiz.quiz_id}/leaderboard`);
        setLeaderboard(lb);
      } catch {}
    } catch(err) { toast.error(err.response?.data?.message || 'Failed to submit'); }
    finally { setLoading(false); }
  };

  const q = quiz.questions[current];
  const total = quiz.questions.length;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !results && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        {!results ? (
          <>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1rem' }}>{quiz.title}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                  Question {current+1} of {total}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX /></button>
            </div>

            {/* Progress bar */}
            <div className="quiz-progress">
              <div className="quiz-progress-fill" style={{ width: `${((current+1)/total)*100}%` }} />
            </div>

            <div className="quiz-question-text">{q.question_text}</div>

            <div className="quiz-options">
              {q.options.map(opt => (
                <button key={opt.option_id}
                  className={`quiz-option ${answers[q.question_id] === opt.option_id ? 'selected' : ''}`}
                  onClick={() => selectAnswer(q.question_id, opt.option_id)}>
                  {opt.option_text}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              {current > 0 && (
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCurrent(c => c-1)}>
                  ← Back
                </button>
              )}
              {current < total - 1 ? (
                <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={() => setCurrent(c => c+1)}
                  disabled={!answers[q.question_id]}>
                  Next →
                </button>
              ) : (
                <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={handleSubmit} disabled={loading || !answers[q.question_id]}>
                  {loading ? 'Submitting…' : 'Submit Quiz'}
                </button>
              )}
            </div>
          </>
        ) : (
          /* Results view */
          <div className="quiz-results">
            <div className="quiz-score-ring">
              <svg width={140} height={140}>
                <circle cx={70} cy={70} r={58} fill="none" stroke="var(--border)" strokeWidth={10} />
                <circle cx={70} cy={70} r={58} fill="none"
                  stroke={results.percentage >= 70 ? 'var(--success)' : results.percentage >= 40 ? '#f59e0b' : 'var(--danger)'}
                  strokeWidth={10}
                  strokeDasharray={`${2*Math.PI*58 * results.percentage / 100} ${2*Math.PI*58}`}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)" />
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                  fill="var(--text)" fontSize={24} fontWeight={800}>{results.percentage}%</text>
                <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle"
                  fill="var(--text3)" fontSize={11}>score</text>
              </svg>
            </div>
            <h3 style={{ textAlign:'center', margin: '1rem 0 0.25rem' }}>
              {results.percentage >= 70 ? '🎉 Great job!' : results.percentage >= 40 ? '📚 Keep learning!' : '💪 Try again!'}
            </h3>
            <p style={{ textAlign:'center', color:'var(--text2)', fontSize:'0.9rem' }}>
              You got <strong>{results.score}</strong> out of <strong>{results.total_points}</strong> points
            </p>

            {/* Per-question feedback */}
            <div className="quiz-feedback" style={{ marginTop: '1.5rem' }}>
              {quiz.questions.map((q, i) => {
                const res = results.results?.find(r => Number(r.question_id) === Number(q.question_id));
                return (
                  <div key={q.question_id} className={`quiz-feedback-row ${res?.is_correct ? 'correct' : 'wrong'}`}>
                    {res?.is_correct ? <FiCheck color="var(--success)" /> : <FiX color="var(--danger)" />}
                    <span>{q.question_text}</span>
                  </div>
                );
              })}
            </div>

            {leaderboard.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', marginBottom: '0.6rem' }}
                  onClick={() => setShowLB(v => !v)}
                >
                  🏆 {showLB ? 'Hide' : 'Show'} Leaderboard ({leaderboard.length})
                </button>
                {showLB && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 240, overflowY: 'auto' }}>
                    {leaderboard.map((entry, idx) => (
                      <div key={entry.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg2)', borderRadius: 8, fontSize: '0.85rem' }}>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, color: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text3)', minWidth: 20 }}>
                          #{idx + 1}
                        </span>
                        <span style={{ flex: 1, fontWeight: 600 }}>{entry.first_name || entry.username}</span>
                        <span style={{ fontFamily: 'Space Mono, monospace', color: 'var(--accent2)', fontWeight: 700 }}>{entry.best_pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Main Quizzes Page ───────────────────────────────────────────────────── */
import { SkelQuizzes } from '../components/Skeleton.jsx';

const Quizzes = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes]       = useState([]);
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizDetail, setQuizDetail] = useState(null);
  const [catFilter, setCatFilter]   = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [activeTab, setActiveTab]   = useState('all');

  const CATS = ['Engineering','Business','Life Skills','Psychology','Teaching Skills','Health & Nutrition','Physical Fitness','Agriculture'];

  const fetchAll = async () => {
    try {
      const params = new URLSearchParams();
      if (catFilter)  params.set('category', catFilter);
      if (diffFilter) params.set('difficulty', diffFilter);
      const [qRes, pRes] = await Promise.all([
        API.get(`/quizzes?${params}`),
        API.get(`/users/${user.user_id}`),
      ]);
      setQuizzes(qRes.data);
      setProfile(pRes.data);
    } catch { toast.error('Failed to load quizzes'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [catFilter, diffFilter]);

  const openQuiz = async (quiz) => {
    try {
      const { data } = await API.get(`/quizzes/${quiz.quiz_id}`);
      setQuizDetail(data);
      setActiveQuiz(data);
    } catch { toast.error('Failed to load quiz'); }
  };

  const myQuizzes = quizzes.filter(q => q.creator === user.username);
  const allQuizzes = activeTab === 'my' ? myQuizzes : quizzes;

  if (loading) return <SkelQuizzes />;

  return (
    <div className="feed-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2>Quizzes</h2>
          <p>Test your knowledge · Only experts can create quizzes</p>
        </div>
        {profile?.is_expert && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <FiPlus /> Create Quiz
          </button>
        )}
      </div>

      {/* Expert badge / request */}
      {!profile?.is_expert && (
        <div className="expert-banner">
          <FiAward size={20} />
          <div>
            <strong>Become an Expert</strong>
            <p>Earn 100+ knowledge points through the Study Engine to unlock quiz creation.</p>
          </div>
          <span className="expert-pts">{Math.min(Number(profile?.total_knowledge || 0).toFixed(1), 100)} / 100 pts</span>
        </div>
      )}
      {profile?.is_expert && (
        <div className="expert-banner success">
          <FiAward size={20} />
          <strong>Verified Expert — You can create quizzes!</strong>
        </div>
      )}

      {/* Filters */}
      <div className="quiz-filters">
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)}>
          <option value="">All Difficulties</option>
          <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          All Quizzes ({quizzes.length})
        </button>
        {profile?.is_expert && (
          <button className={`tab ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>
            My Quizzes ({myQuizzes.length})
          </button>
        )}
      </div>

      {/* Quiz List */}
      {allQuizzes.length === 0 ? (
        <div className="empty-state"><h3>No quizzes found</h3><p>Try changing your filters</p></div>
      ) : (
        <div className="quiz-list">
          {allQuizzes.map(quiz => (
            <div key={quiz.quiz_id} className="quiz-card">
              <div className="quiz-card-top">
                <div className="quiz-meta">
                  {quiz.category && <span className="quiz-cat-tag">{quiz.category}</span>}
                  <span className={`quiz-diff ${quiz.difficulty?.toLowerCase()}`}>{quiz.difficulty}</span>
                  {Number(quiz.user_attempted) > 0 && <span className="quiz-done">✓ Attempted</span>}
                </div>
                <h4 className="quiz-title">{quiz.title}</h4>
                {quiz.description && <p className="quiz-desc">{quiz.description}</p>}
              </div>
              <div className="quiz-card-bottom">
                <div className="quiz-stats">
                  <span>{quiz.question_count} questions</span>
                  <span>{quiz.attempt_count} attempts</span>
                  <span>by <strong>{quiz.first_name || quiz.creator}</strong> {quiz.is_expert ? '⭐' : ''}</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => openQuiz(quiz)}>
                  {Number(quiz.user_attempted) > 0 ? 'Retake' : 'Start'} <FiChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateQuizModal onClose={() => setShowCreate(false)} onCreated={fetchAll} />}
      {activeQuiz && (
        <TakeQuizModal
          quiz={activeQuiz}
          onClose={() => setActiveQuiz(null)}
          onCompleted={() => { setActiveQuiz(null); fetchAll(); }}
        />
      )}
    </div>
  );
};

export default Quizzes;