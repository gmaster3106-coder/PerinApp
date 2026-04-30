import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { JOURNEY_STAGES } from '../data/journey.js';
import { SCENARIOS } from '../data/scenarios.js';

function isScenarioDone(lang, dialect, level, idx) {
  try {
    const completed = JSON.parse(localStorage.getItem('perin_completed') || '{}');
    return !!completed[`${lang}_${dialect}_${level}_${idx}`];
  } catch { return false; }
}

function isNextToComplete(lang, dialect, stage, stageIdx, nodeIdx) {
  for (let s = 0; s < stageIdx; s++) {
    const prev = JOURNEY_STAGES[s];
    if (!prev.indices.every(idx => isScenarioDone(lang, dialect, prev.level, idx))) return false;
  }
  for (let n = 0; n < nodeIdx; n++) {
    if (!isScenarioDone(lang, dialect, stage.level, stage.indices[n])) return false;
  }
  return true;
}

function getPrevNodeDone(lang, dialect, stage, stageIdx, nodeIdx) {
  if (nodeIdx > 0) return isScenarioDone(lang, dialect, stage.level, stage.indices[nodeIdx - 1]);
  if (stageIdx > 0) {
    const prev = JOURNEY_STAGES[stageIdx - 1];
    return isScenarioDone(lang, dialect, prev.level, prev.indices[prev.indices.length - 1]);
  }
  return false;
}

export default function Journey() {
  const { state, isPro } = useApp();
  const navigate = useNavigate();
  const lang = state.activeLang?.lang || state.languages?.[0]?.lang || '';
  const dialect = state.activeLang?.dialect || state.languages?.[0]?.dialect || lang;

  const totalNodes = JOURNEY_STAGES.reduce((sum, s) => sum + s.indices.length, 0);
  const doneNodes = JOURNEY_STAGES.reduce((sum, s) =>
    sum + s.indices.filter(idx => isScenarioDone(lang, dialect, s.level, idx)).length, 0);
  const pct = totalNodes ? Math.round(doneNodes / totalNodes * 100) : 0;

  function startNode(level, scenarioIdx) {
    if (level === 'native' && !isPro()) { alert('Native mode requires Perin Pro'); return; }
    const scenario = SCENARIOS[level]?.[scenarioIdx];
    if (!scenario) return;
    navigate('/wordprep', { state: { scenario, level, idx: scenarioIdx, lang, dialect } });
  }

  const allDone = JOURNEY_STAGES.every(s => s.indices.every(idx => isScenarioDone(lang, dialect, s.level, idx)));

  return (
    <div className="screen active" id="screen-journey">
      <div style={{ width: '100%', maxWidth: '480px', padding: '0 0 60px' }}>

        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '2px' }}>
              {lang}{dialect && dialect !== lang ? ` · ${dialect}` : ''}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', fontWeight: '700', margin: '0 0 10px', letterSpacing: '-.3px' }}>Your Journey</h2>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{doneNodes} of {totalNodes} scenarios</span>
                <span style={{ fontSize: '.72rem', fontWeight: '700', color: 'var(--accent)' }}>{pct}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width .6s' }}></div>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/scenarios')} style={{ background: 'var(--cream)', border: '1.5px solid var(--border)', borderRadius: '10px', padding: '8px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', fontWeight: '600', cursor: 'pointer', color: 'var(--ink)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Freestyle
          </button>
        </div>

        <div style={{ padding: '4px 0' }}>
          {JOURNEY_STAGES.map((stage, stageIdx) => {
            const stageDoneCount = stage.indices.filter(idx => isScenarioDone(lang, dialect, stage.level, idx)).length;
            const stageTotal = stage.indices.length;
            const stagePct = Math.round(stageDoneCount / stageTotal * 100);
            const stageDone = stageDoneCount === stageTotal;
            const levelLabel = stage.level === 'native' ? 'Native' : stage.level.charAt(0).toUpperCase() + stage.level.slice(1);
            const isNativeStage = stage.nativeStage;
            const borderTop = stageIdx > 0 ? { borderTop: '1px solid var(--border)', marginTop: '8px' } : {};

            return (
              <div key={stageIdx}>
                <div style={{ padding: '28px 20px 16px', ...borderTop }}>
                  <div style={{ fontSize: '.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '4px' }}>{levelLabel}</div>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', fontWeight: '700', margin: '0 0 10px', letterSpacing: '-.3px', color: 'var(--ink)' }}>{stage.label}</h3>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{stageDoneCount} of {stageTotal} scenarios</span>
                      <span style={{ fontSize: '.72rem', fontWeight: '700', color: 'var(--accent)' }}>{stagePct}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stagePct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width .6s' }}></div>
                    </div>
                  </div>
                </div>

                {stage.indices.map((scenarioIdx, i) => {
                  const scenario = SCENARIOS[stage.level]?.[scenarioIdx];
                  if (!scenario) return null;
                  const done = isScenarioDone(lang, dialect, stage.level, scenarioIdx);
                  const isCurrent = !done && isNextToComplete(lang, dialect, stage, stageIdx, i);
                  const locked = !done && !isCurrent;
                  const infoRight = i % 2 === 0;
                  const prevDone = getPrevNodeDone(lang, dialect, stage, stageIdx, i);

                  return (
                    <div key={scenarioIdx}>
                      {(stageIdx > 0 || i > 0) && (
                        <div className={`journey-connector${prevDone ? ' done' : ''}`}></div>
                      )}
                      <div className="journey-node-row">
                        <div className={`journey-node-info ${infoRight ? 'left' : 'right'}`}>
                          <div className="journey-node-title">{scenario.title}</div>
                          <div className="journey-node-xp">+{scenario.xp} XP{done ? ' · Done' : isCurrent ? ' · Up next' : ''}</div>
                        </div>
                        <div
                          className={`journey-node ${done ? 'done' : isCurrent ? 'current' : 'locked'} ${stage.level}-node`}
                          onClick={() => !locked && startNode(stage.level, scenarioIdx)}
                        >
                          <div className="journey-node-icon">{done ? '✓' : scenario.icon}</div>
                          {done && <div className="journey-node-check">✓</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className={`journey-connector${stageDone ? ' done' : ''}`}></div>
                <div
                  className={`journey-milestone${stageDone ? '' : ' locked'}`}
                  style={isNativeStage ? { background: 'linear-gradient(135deg,#1a0a2e,#2d1060)', borderColor: '#7c3aed' } : {}}
                >
                  <div className="journey-milestone-icon">{stageDone ? '🏆' : stage.milestone.icon}</div>
                  <div className="journey-milestone-text">
                    <div className="journey-milestone-title" style={isNativeStage ? { color: '#ede9fe' } : {}}>{stage.milestone.title}</div>
                    <div className="journey-milestone-sub" style={isNativeStage ? { color: '#a78bfa' } : {}}>{stageDone ? 'Completed!' : stage.milestone.reward}</div>
                  </div>
                  {stageDone && <div style={{ fontSize: '1.2rem' }}>✓</div>}
                </div>
              </div>
            );
          })}

          <div className="journey-connector"></div>
          <div className="journey-native-card" style={{ margin: '8px 16px 40px' }}>
            <div className="journey-native-title">{allDone ? '🏆 Journey Complete' : '🎯 The Finish Line'}</div>
            <div className="journey-native-sub">{allDone ? 'You have completed every stage. Real fluency.' : 'Complete all stages to finish your journey.'}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
