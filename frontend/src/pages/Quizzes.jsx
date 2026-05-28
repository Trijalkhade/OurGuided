import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../context/AuthContext';
import useFeedback from '../utils/useFeedback';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiAward, FiTrash2, FiChevronRight, FiEye } from 'react-icons/fi';
import * as cache from '../utils/cache';


/* ═══════════════════════════════════════════════════════════════
   ANSWER SHEET MODAL — full review of quiz attempt
   Green ✓  = correct answer
   Blue dot = user's selection
   Red ✗    = wrong selection
═══════════════════════════════════════════════════════════════ */
const AnswerSheetModal = ({ quizTitle, score, totalPoints, percentage, review, onClose }) => {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal answer-sheet-modal">
        {/* Header with score ring */}
        <div className="modal-header">
          <h3>{quizTitle || 'Answer Sheet'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX /></button>
        </div>

        {/* Score summary */}
        <div className="answer-sheet-score">
          <div className="quiz-score-ring">
            <svg width={110} height={110}>
              <circle cx={55} cy={55} r={45} fill="none" stroke="var(--border)" strokeWidth={8} />
              <circle cx={55} cy={55} r={45} fill="none"
                stroke={percentage >= 70 ? 'var(--success)' : percentage >= 40 ? '#f59e0b' : 'var(--danger)'}
                strokeWidth={8}
                strokeDasharray={`${2*Math.PI*45 * percentage / 100} ${2*Math.PI*45}`}
                strokeLinecap="round"
                transform="rotate(-90 55 55)" />
              <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle"
                fill="var(--text)" fontSize={20} fontWeight={800}>{percentage}%</text>
              <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle"
                fill="var(--text3)" fontSize={10}>{score}/{totalPoints}</text>
            </svg>
          </div>
          <div className="answer-sheet-score-label">
            {percentage >= 70 ? '🎉 Great job!' : percentage >= 40 ? '📚 Keep learning!' : '💪 Try again!'}
          </div>
        </div>

        <div className="divider" />

        {/* Questions list */}
        <div className="answer-sheet-questions">
          {review.map((q, idx) => {
            const userOpt = q.options.find(o => o.user_selected);
            const isCorrect = userOpt && userOpt.is_correct;

            return (
              <div key={q.question_id} className="answer-q-card">
                <div className="answer-q-header">
                  <span className={`answer-q-num ${isCorrect ? 'correct' : 'wrong'}`}>
                    {isCorrect ? <FiCheck size={12} /> : <FiX size={12} />}
                    Q{idx + 1}
                  </span>
                  <span className="answer-q-pts">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                </div>
                <div className="answer-q-text">{q.question_text}</div>
                <div className="answer-opts">
                  {q.options.map(opt => {
                    let cls = 'answer-opt';
                    if (opt.is_correct && opt.user_selected) cls += ' correct selected';
                    else if (opt.is_correct) cls += ' correct';
                    else if (opt.user_selected) cls += ' wrong-selected';

                    return (
                      <div key={opt.option_id} className={cls}>
                        <span className="answer-opt-indicator">
                          {opt.is_correct && opt.user_selected && <FiCheck size={14} />}
                          {opt.is_correct && !opt.user_selected && <FiCheck size={14} />}
                          {!opt.is_correct && opt.user_selected && <FiX size={14} />}
                          {!opt.is_correct && !opt.user_selected && <span className="answer-opt-dot" />}
                        </span>
                        <span className="answer-opt-text">{opt.option_text}</span>
                        {opt.is_correct && <span className="answer-opt-label correct-label">Correct</span>}
                        {opt.user_selected && !opt.is_correct && <span className="answer-opt-label your-label">Your answer</span>}
                        {opt.is_correct && opt.user_selected && <span className="answer-opt-label your-label" style={{marginLeft: '.25rem'}}>✓ You</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   CREATE QUIZ MODAL
═══════════════════════════════════════════════════════════════ */
const CreateQuizModal = ({ onClose, onCreated }) => {
  const { onTap, onSuccess, onError, onCreateSuccess } = useFeedback();
  const [form, setForm] = useState({ title: '', description: '', category: '', difficulty: 'Beginner' });
  const [questions, setQuestions] = useState([{ question_text: '', points: 1, options: [
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
  ]}]);
  const [loading, setLoading] = useState(false);

  const CATEGORIES = ['Real Talk', 'Experiments & Ideas', 'Loopholes & Fixes', 'Life Hacks', 'Youth & Education', 'Health & Body', 'Earth & Hands', 'Economy & Power'];

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
    onTap();
    setLoading(true);
    try {
      await API.post('/quizzes', { ...form, questions });
      onCreateSuccess(); // Beep + chime on quiz published
      toast.success('Quiz created and published!');
      cache.invalidatePrefix('quizzes');
      onCreated();
      onClose();
    } catch(err) { 
      onError();
      toast.error(err.response?.data?.message || 'Failed to create quiz'); 
    }
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
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Spot the Loophole" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="What should people know after this?" />
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


/* ═══════════════════════════════════════════════════════════════
   TAKE QUIZ MODAL — now opens answer sheet after submission
═══════════════════════════════════════════════════════════════ */
const TakeQuizModal = ({ quiz, onClose, onCompleted }) => {
  const { onTap, onSuccess, onError, onCelebration } = useFeedback();
  const [answers, setAnswers]       = useState({});
  const [results, setResults]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [current, setCurrent]       = useState(0);

  const selectAnswer = (qId, optId) => {
    onTap(); // Haptic feedback on selection
    setAnswers(prev => ({ ...prev, [qId]: optId }));
  };

  const handleSubmit = async () => {
    const answered = Object.keys(answers).length;
    if (answered < quiz.questions.length)
      return toast.error(`Please answer all ${quiz.questions.length} questions`);
    onTap();
    setLoading(true);
    try {
      const payload = Object.entries(answers).map(([question_id, option_id]) => ({ question_id, option_id }));
      const { data } = await API.post(`/quizzes/${quiz.quiz_id}/submit`, { answers: payload });
      setResults(data);
      onCelebration(); // Celebration feedback on quiz completion
      toast.success(`Quiz completed! You scored ${data.percentage}%`);
      cache.invalidatePrefix('quizzes');
      onCompleted?.(data);
    } catch(err) { 
      onError();
      toast.error(err.response?.data?.message || 'Failed to submit'); 
    }
    finally { setLoading(false); }
  };

  const q = quiz.questions[current];
  const total = quiz.questions.length;

  // If we have results with review data, show AnswerSheetModal
  if (results && results.review) {
    return (
      <AnswerSheetModal
        quizTitle={quiz.title}
        score={results.score}
        totalPoints={results.total_points}
        percentage={results.percentage}
        review={results.review}
        onClose={onClose}
      />
    );
  }

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
          /* Fallback results if review somehow missing */
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
            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   MAIN QUIZZES PAGE
═══════════════════════════════════════════════════════════════ */
import { SkelQuizzes } from '../components/Skeleton.jsx';

const Quizzes = () => {
  const { user } = useAuth();
  const { onTap } = useFeedback();
  const [quizzes, setQuizzes]       = useState([]);
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizDetail, setQuizDetail] = useState(null);
  const [catFilter, setCatFilter]   = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [activeTab, setActiveTab]   = useState('all');
  // State for viewing past answer sheets
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(null); // quiz_id being loaded

  const CATS = ['Real Talk', 'Experiments & Ideas', 'Loopholes & Fixes', 'Life Hacks', 'Youth & Education', 'Health & Body', 'Earth & Hands', 'Economy & Power'];

  const quizCacheKey = `quizzes:${catFilter}:${diffFilter}`;

  const fetchAll = async (silent = false) => {
    if (!silent) { setLoading(true); setError(false); }
    try {
      const params = new URLSearchParams();
      if (catFilter)  params.set('category', catFilter);
      if (diffFilter) params.set('difficulty', diffFilter);

      // Try to get profile from cache
      const cachedProfile = cache.get(`profile:${user.user_id}`);

      const [qRes, pRes] = await Promise.all([
        API.get(`/quizzes?${params}`),
        cachedProfile && !cachedProfile.stale
          ? Promise.resolve({ data: cachedProfile.data })
          : API.get(`/users/${user.user_id}`),
      ]);
      setQuizzes(qRes.data);
      setProfile(pRes.data);
      cache.set(quizCacheKey, qRes.data, 'quizzes');
      cache.set(`profile:${user.user_id}`, pRes.data, 'profile_own');
    } catch { 
      if (!silent) { setError(true); toast.error('Failed to load quizzes'); }
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    // Check cache for quizzes
    const cachedQuizzes = cache.get(quizCacheKey);
    const cachedProfile = cache.get(`profile:${user.user_id}`);
    if (cachedQuizzes && cachedProfile) {
      setQuizzes(cachedQuizzes.data);
      setProfile(cachedProfile.data);
      setLoading(false);
      fetchAll(true); // silent revalidate
    } else {
      fetchAll();
    }
  }, [catFilter, diffFilter]);

  const openQuiz = async (quiz) => {
    try {
      const { data } = await API.get(`/quizzes/${quiz.quiz_id}`);
      setQuizDetail(data);
      setActiveQuiz(data);
    } catch { toast.error('Failed to load quiz'); }
  };

  /* Fetch answer sheet for a past attempt */
  const viewAnswerSheet = async (quiz) => {
    onTap();
    setReviewLoading(quiz.quiz_id);
    try {
      // First fetch the quiz detail to get the attempt_id
      const { data: quizData } = await API.get(`/quizzes/${quiz.quiz_id}`);
      if (!quizData.user_attempt?.attempt_id) {
        toast.error('No attempt found for this quiz');
        setReviewLoading(null);
        return;
      }
      const { data } = await API.get(`/quizzes/${quiz.quiz_id}/review/${quizData.user_attempt.attempt_id}`);
      setReviewData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load answer sheet');
    }
    setReviewLoading(null);
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
          <p>Challenge what you know · Only experts can create quizzes</p>
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
            <p>Earn 100+ points through the Usage Tracker to unlock quiz creation.</p>
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
      {error && quizzes.length === 0 ? (
        <div className="empty-state">
          <h3>Failed to load quizzes</h3>
          <p>Please try again later.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchAll()} style={{ marginTop: '1rem' }}>
            Try Again
          </button>
        </div>
      ) : allQuizzes.length === 0 ? (
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
                <div className="quiz-card-actions">
                  {Number(quiz.user_attempted) > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => viewAnswerSheet(quiz)}
                      disabled={reviewLoading === quiz.quiz_id}
                    >
                      <FiEye size={13} />
                      {reviewLoading === quiz.quiz_id ? 'Loading…' : 'Answers'}
                    </button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={() => openQuiz(quiz)}>
                    {Number(quiz.user_attempted) > 0 ? 'Retake' : 'Start'} <FiChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateQuizModal onClose={() => setShowCreate(false)} onCreated={() => fetchAll(true)} />}
      {activeQuiz && (
        <TakeQuizModal
          quiz={activeQuiz}
          onClose={() => setActiveQuiz(null)}
          onCompleted={() => { setActiveQuiz(null); fetchAll(true); }}
        />
      )}

      {/* Answer sheet modal for past attempts */}
      {reviewData && (
        <AnswerSheetModal
          quizTitle={reviewData.quiz_title}
          score={reviewData.score}
          totalPoints={reviewData.total_points}
          percentage={Number(reviewData.percentage)}
          review={reviewData.review}
          onClose={() => setReviewData(null)}
        />
      )}
    </div>
  );
};

export default Quizzes;