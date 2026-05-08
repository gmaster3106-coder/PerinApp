import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { JOURNEY_STAGES } from '../data/journey.js';
import { SCENARIOS } from '../data/scenarios.js';
import { CONNECTIONS_DATA } from '../data/connections.js';
import { OB_DIALECTS } from '../data/languages.js';
import { getDailyFact, CULTURE_FACTS, getFactsForDialect } from '../data/cultureFacts.js';

const LANG_FLAGS = {
  Spanish: '🇪🇸', French: '🇫🇷', Italian: '🇮🇹', Portuguese: '🇵🇹',
  English: '🇺🇸', Creole: '🇭🇹',
};

function isScenarioDone(lang, dialect, level, idx) {
  try {
    const c = JSON.parse(localStorage.getItem('perin_completed') || '{}');
    return !!c[`${lang}_${dialect}_${level}_${idx}`];
  } catch { return false; }
}

function getNextJourneyScenario(lang, dialect) {
  for (const stage of JOURNEY_STAGES) {
    for (const idx of stage.indices) {
      if (!isScenarioDone(lang, dialect, stage.level, idx)) {
        return { level: stage.level, idx, scenario: SCENARIOS[stage.level]?.[idx], label: stage.label };
      }
    }
  }
  return null;
}

function getCurrentStageProgress(lang, dialect) {
  for (const stage of JOURNEY_STAGES) {
    const done = stage.indices.filter(idx => isScenarioDone(lang, dialect, stage.level, idx)).length;
    const total = stage.indices.length;
    if (done < total) return { done, total, label: stage.label };
  }
  return null;
}

function getNewlyUnlockedStage(lang, dialect) {
  for (let i = 0; i < JOURNEY_STAGES.length - 1; i++) {
    const stage = JOURNEY_STAGES[i];
    const next = JOURNEY_STAGES[i + 1];
    const stageDone = stage.indices.every(idx => isScenarioDone(lang, dialect, stage.level, idx));
    const bannerKey = `perin_unlock_banner_${lang}_${dialect}_${i}`;
    if (stageDone && !localStorage.getItem(bannerKey)) {
      return { stage: next, key: bannerKey };
    }
  }
  return null;
}

function getHoursToday() {
  try {
    const key = 'perin_daily_mins_' + new Date().toDateString();
    return parseInt(localStorage.getItem(key) || '0');
  } catch { return 0; }
}

function DailyRing({ goal = 30 }) {
  const done = Math.min(getHoursToday(), goal);
  const complete = done >= goal;
  const r = 28, circ = 2 * Math.PI * r;
  const fill = circ * (done / goal);
  return (
    <div style={{ flexShrink: 0, cursor: 'pointer', textAlign: 'center' }}>
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={r} fill="none" stroke="var(--border)" strokeWidth="5"/>
        <circle cx="35" cy="35" r={r} fill="none" stroke={complete ? '#4caf50' : 'var(--accent)'}
          strokeWidth="5" strokeDasharray={`${fill} ${circ - fill}`}
          strokeDashoffset={circ * 0.25} strokeLinecap="round"/>
        <text x="35" y="39" textAnchor="middle" fontSize="13" fontWeight="700"
          fill={complete ? '#4caf50' : 'var(--ink)'} fontFamily="DM Sans,sans-serif">
          {complete ? '✓' : `${done}m`}
        </text>
      </svg>
      <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '3px' }}>
        {complete ? 'Goal done! 🎉' : `of ${goal}m`}
      </div>
    </div>
  );
}

function LangCard({ lang: l, active, onClick }) {
  const level = Math.floor((l.xp || 0) / 100) + 1;
  return (
    <div className={`lang-card${active ? ' active' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="lang-flag">{l.flag || '🌍'}</div>
      <div className="lang-info">
        <div className="lang-name">
          {l.lang}{l.dialect && l.dialect !== l.lang && <span style={{ fontWeight: '400', color: 'var(--muted)', fontSize: '.8rem' }}> · {l.dialect}</span>}
        </div>
        <div className="lang-stats">
          <span className="lang-stat">Lv <strong>{level}</strong></span>
          <span className="lang-stat"><strong>{l.xp || 0}</strong> XP</span>
          <span className="lang-stat"><strong>{l.sessions || 0}</strong> sessions</span>
        </div>
        <div className="lang-progress-bar">
          <div className="lang-progress-fill" style={{ width: `${(l.xp || 0) % 100}%` }}></div>
        </div>
      </div>
    </div>
  );
}

function AddLangPanel({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('');
  const [dialect, setDialect] = useState('');
  const TARGET_LANGS = [
    { lang: 'Spanish', flag: '🇪🇸' }, { lang: 'French', flag: '🇫🇷' },
    { lang: 'Italian', flag: '🇮🇹' }, { lang: 'Portuguese', flag: '🇵🇹' },
    { lang: 'English', flag: '🇺🇸' }, { lang: 'Creole', flag: '🇭🇹' },
  ];
  const dialects = OB_DIALECTS[lang] || [];

  function handleAdd() {
    if (!lang) return;
    const d = dialect || lang;
    const flag = dialects.find(x => x.dialect === d)?.flag || LANG_FLAGS[lang] || '🌍';
    onAdd({ lang, dialect: d, flag, xp: 0, sessions: 0, level: 'beginner', dailyGoal: 30 });
    setOpen(false); setLang(''); setDialect('');
  }

  return (
    <div id="add-lang-panel" style={{ marginBottom: '12px' }}>
      <button className="dash-add-btn" onClick={() => setOpen(o => !o)}>＋ Add a Language</button>
      {open && (
        <div className="add-lang-form" style={{ marginTop: '12px' }}>
          <div className="form-group" style={{ margin: '0 0 12px' }}>
            <label>Language</label>
            <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
              {TARGET_LANGS.map(l => (
                <button key={l.lang} className={`ob-lang-btn add-lang-btn${lang === l.lang ? ' selected' : ''}`}
                  onClick={() => { setLang(l.lang); setDialect(''); }}>
                  <span>{l.flag}</span>{l.lang}
                </button>
              ))}
            </div>
          </div>
          {lang && dialects.length > 0 && (
            <div className="form-group" style={{ margin: '0 0 12px' }}>
              <label>Dialect</label>
              <div className="ob-lang-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                {dialects.map(d => (
                  <button key={d.dialect} className={`ob-lang-btn add-lang-btn${dialect === d.dialect ? ' selected' : ''}`}
                    onClick={() => setDialect(d.dialect)}>
                    <span>{d.flag}</span>{d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '9px' }}>
            <button className="btn-primary" style={{ flex: 1, margin: 0 }} onClick={handleAdd}>Add →</button>
            <button className="btn-back" style={{ margin: 0 }} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionsPanel({ languages }) {
  const relevant = useMemo(() => {
    const langNames = languages.map(l => l.lang);
    const results = [];
    for (const group of CONNECTIONS_DATA) {
      const entries = group.entries?.filter(e => e.langs?.some(l => langNames.includes(l))) || [];
      if (entries.length) results.push({ ...group, entries });
    }
    return results.flatMap(g => g.entries.slice(0, 1).map(e => ({ ...e, groupLabel: g.label }))).slice(0, 3);
  }, [languages]);

  if (!relevant.length) return null;

  return (
    <div className="connections-card" style={{ marginTop: '16px' }}>
      <div className="connections-header">
        <span style={{ fontSize: '1.1rem' }}>🔗</span>
        <h3>Language Connections</h3>
      </div>
      {relevant.map((entry, i) => (
        <div key={i} className="connection-row">
          <div className="connection-label">{entry.groupLabel}</div>
          <div className="connection-langs">
            {(entry.langs || []).slice(0, 3).map((lang, j) => (
              <span key={j}>
                {j > 0 && <span className="conn-arrow">↔</span>}
                <div className="conn-lang">
                  <span className="cl-flag">{LANG_FLAGS[lang] || '🌍'}</span>
                  <span className="cl-word">{entry.words?.[j] || ''}</span>
                </div>
              </span>
            ))}
          </div>
          <div className="connection-note">{entry.note}</div>
        </div>
      ))}
    </div>
  );
}

const MISSION_ROUTES = {
  scenario: '/scenarios', scene: '/scenes', freechat: '/chat',
  fib: '/fib', sentence: '/sentence-builder', sentence_builder: '/sentence-builder',
  listening: '/listening', quiz: '/vocab-quiz', srs: '/srs',
  vocabquiz: '/vocab-quiz',
};

const AFTER_MISSION_SUGGESTIONS = [
  { label: '🗺️ Continue your journey', path: 'journey' },
  { label: '✏️ Fill the Blank drill', path: '/fib' },
  { label: '🧠 Culture Quiz', path: '/vocab-quiz' },
  { label: '🔁 Review vocab', path: '/srs' },
  { label: '🎧 Listen & Respond', path: '/listening' },
  { label: '🎬 Try Scene Mode', path: '/scenes' },
];

function getDailyMission(sessions) {
  const key = 'perin_mission_' + new Date().toDateString();
  const saved = localStorage.getItem(key);
  if (saved) try { return JSON.parse(saved); } catch {}

  const pool = sessions === 0
    ? [{ task: 'Complete your first scenario conversation', type: 'scenario', icon: '💬', xp: 50 }]
    : sessions < 3
    ? [
        { task: 'Complete a scenario conversation', type: 'scenario', icon: '💬', xp: 50 },
        { task: 'Finish a Fill in the Blank drill', type: 'fib', icon: '✏️', xp: 30 },
        { task: 'Try a Culture Quiz', type: 'quiz', icon: '🧠', xp: 35 },
      ]
    : [
        { task: 'Complete a scenario conversation', type: 'scenario', icon: '💬', xp: 50 },
        { task: 'Try a Scene Mode conversation', type: 'scene', icon: '🎬', xp: 60 },
        { task: 'Have a free conversation about anything', type: 'freechat', icon: '💬', xp: 45 },
        { task: 'Finish a Fill in the Blank drill', type: 'fib', icon: '✏️', xp: 30 },
        { task: 'Try a Culture Quiz', type: 'quiz', icon: '🧠', xp: 35 },
        { task: 'Review your saved vocabulary', type: 'srs', icon: '🔁', xp: 25 },
        { task: 'Try a Listen & Respond drill', type: 'listening', icon: '🎧', xp: 35 },
        { task: 'Build a sentence in the Sentence Builder', type: 'sentence', icon: '🔤', xp: 30 },
      ];

  const seed = new Date().toDateString();
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  const mission = pool[Math.abs(hash) % pool.length];
  try { localStorage.setItem(key, JSON.stringify(mission)); } catch {}
  return mission;
}

function isDailyMissionDone() {
  return !!localStorage.getItem('perin_mission_done_' + new Date().toDateString());
}

function DailyMission({ sessions, navigate, nextJourney }) {
  const mission = getDailyMission(sessions);
  const done = isDailyMissionDone();
  const route = MISSION_ROUTES[mission.type] || '/scenarios';

  const suggestions = AFTER_MISSION_SUGGESTIONS.filter(s => {
    if (s.path === 'journey') return !!nextJourney;
    return !route.includes(s.path.replace('/', ''));
  }).slice(0, 2);

  return (
    <div className={`mission-card${done ? ' mission-done' : ''}`} style={{ marginBottom: '10px' }}>
      <div className="mission-header">
        <span className="mission-icon">{mission.icon}</span>
        <div>
          <div className="mission-label">Today's mission</div>
          <div className="mission-task">{mission.task}</div>
        </div>
        {done
          ? <span className="mission-check">✓ Done</span>
          : <span className="mission-xp">+{mission.xp} XP</span>
        }
      </div>
      {!done && (
        <button className="btn-primary" style={{ width: '100%', marginTop: '10px', fontSize: '.85rem', padding: '10px' }}
          onClick={() => navigate(route)}>
          Start →
        </button>
      )}
      {done && suggestions.length > 0 && (
        <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          <div style={{ fontSize: '.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '7px' }}>
            Keep going
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => s.path === 'journey' ? navigate('/journey') : navigate(s.path)}
                style={{ flex: 1, background: 'var(--cream)', border: '1.5px solid var(--border)', borderRadius: '10px', padding: '8px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', fontWeight: '600', color: 'var(--ink)', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getScenarioRevisitSuggestion(lang, dialect) {
  try {
    const completed = JSON.parse(localStorage.getItem('perin_completed') || '{}');
    const playCounts = JSON.parse(localStorage.getItem(`perin_play_counts_${lang}_${dialect}`) || '{}');
    const candidates = Object.entries(completed)
      .filter(([key, val]) => {
        if (!val) return false;
        const parts = key.split('_');
        return parts[0] === lang && parts[1] === dialect;
      })
      .map(([key]) => {
        const parts = key.split('_');
        const level = parts[2];
        const idx = parseInt(parts[3]);
        const scenario = SCENARIOS[level]?.[idx];
        const playCount = playCounts[scenario?.title] || 1;
        return { key, level, idx, scenario, playCount };
      })
      .filter(c => c.scenario && c.playCount <= 2);
    if (!candidates.length) return null;
    const seed = new Date().toDateString() + lang + dialect;
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
    return candidates[Math.abs(hash) % candidates.length];
  } catch { return null; }
}

function CultureCard({ dialect, lang }) {
  const [expanded, setExpanded] = React.useState(false);
  const fact = getDailyFact(dialect, lang);
  if (!fact) return null;
  return (
    <div onClick={() => setExpanded(e => !e)} style={{ background: 'linear-gradient(135deg,var(--card),rgba(26,86,219,.03))', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '14px 16px', marginBottom: '10px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{fact.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.6rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', marginBottom: '3px' }}>
            Daily Culture · {dialect !== lang ? dialect : lang}
          </div>
          <div style={{ fontSize: '.88rem', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.3' }}>{fact.headline}</div>
        </div>
        {/* Use a span without transform to avoid fixed positioning issues */}
        <span style={{ color: 'var(--muted)', fontSize: '1rem', flexShrink: 0 }}>{expanded ? '↓' : '›'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '.82rem', color: 'var(--ink)', lineHeight: '1.6', marginBottom: '10px' }}>{fact.body}</p>
          <div style={{ background: 'rgba(26,86,219,.06)', borderRadius: '8px', padding: '8px 12px', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: '.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', marginBottom: '3px' }}>💬 In conversations</div>
            <p style={{ fontSize: '.78rem', color: 'var(--ink)', lineHeight: '1.5', margin: 0 }}>{fact.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CulturalOnboardingModal({ dialect, lang, onClose }) {
  const facts = CULTURE_FACTS[dialect] || CULTURE_FACTS[lang] || [];
  const highlights = facts.slice(0, 3);
  const dialectLabel = dialect !== lang ? dialect : lang;

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px',
        width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{facts[0]?.emoji || '🌍'}</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', fontWeight: '700', marginBottom: '6px' }}>
            Welcome to {dialectLabel}
          </div>
          <p style={{ fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            A few things that'll help your conversations feel natural from day one.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {highlights.map((fact, i) => (
            <div key={i} style={{ background: 'var(--cream)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{fact.emoji}</span>
              <div>
                <div style={{ fontSize: '.85rem', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>{fact.headline}</div>
                <div style={{ fontSize: '.76rem', color: 'var(--muted)', lineHeight: 1.5 }}>{fact.tip}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '14px', padding: '14px', fontFamily: "'DM Sans',sans-serif", fontSize: '.95rem', fontWeight: '700', cursor: 'pointer' }}>
          Let's start →
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [drillsOpen, setDrillsOpen] = useState(false);
  const [unlockedBanner, setUnlockedBanner] = useState(() => null);
  const [onboarding, setOnboarding] = useState(null);

  const profile = state.profile;
  const languages = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang = activeLang?.lang || '';
  const dialect = activeLang?.dialect || lang;

  const h = new Date().getHours();
  const name = profile?.name ? `, ${profile.name}` : '';
  const greeting = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + name;

  const lastDate = profile?.lastDate;
  const today = new Date().toDateString();
  const daysSince = lastDate && lastDate !== today
    ? Math.round((Date.now() - new Date(lastDate).getTime()) / 86400000) : 0;
  const sub = daysSince >= 3
    ? `${daysSince} days since your last session — easy to get back into it.`
    : 'What are you practicing today?';

  const next = lang ? getNextJourneyScenario(lang, dialect) : null;
  const anyDone = lang && JOURNEY_STAGES.some(s => s.indices.some(idx => isScenarioDone(lang, dialect, s.level, idx)));
  const stageProgress = lang ? getCurrentStageProgress(lang, dialect) : null;
  const revisit = lang ? getScenarioRevisitSuggestion(lang, dialect) : null;

  useMemo(() => {
    if (!lang) return;
    const unlocked = getNewlyUnlockedStage(lang, dialect);
    if (unlocked) setUnlockedBanner(unlocked);
  }, [lang, dialect]);

  function dismissUnlockedBanner() {
    if (unlockedBanner?.key) localStorage.setItem(unlockedBanner.key, '1');
    setUnlockedBanner(null);
  }

  function selectLang(l) {
    dispatch({ type: 'SET_ACTIVE_LANG', payload: l });
    navigate('/journey');
  }

  function addLanguage(newLang) {
    const updated = [...languages, newLang];
    dispatch({ type: 'SET_LANGUAGES', payload: updated });
    dispatch({ type: 'SET_ACTIVE_LANG', payload: newLang });
    const d = newLang.dialect || newLang.lang;
    const l = newLang.lang;
    if (getFactsForDialect(d, l)) {
      setOnboarding({ dialect: d, lang: l });
    }
  }

  function continueJourney() {
    if (!next) return;
    navigate('/wordprep', { state: { scenario: next.scenario, level: next.level, idx: next.idx, lang, dialect } });
  }

  return (
    <div className="screen active" id="screen-setup">
      {onboarding && (
        <CulturalOnboardingModal
          dialect={onboarding.dialect}
          lang={onboarding.lang}
          onClose={() => setOnboarding(null)}
        />
      )}
      <div style={{ width: '100%', maxWidth: '600px' }}>

        <div className="dash-top">
          <div>
            <div className="dash-greeting">{greeting}</div>
            <div className="dash-sub">{sub}</div>
          </div>
          {lang && <DailyRing goal={activeLang?.dailyGoal || 30} />}
        </div>

        {lang && (() => {
          const streak = profile?.streak || 0;
          const lastDate = profile?.lastDate || '';
          const today = new Date().toDateString();
          const hour = new Date().getHours();
          const practisedToday = lastDate === today;
          const streakAtRisk = streak >= 3 && !practisedToday && hour >= 20;
          if (!streakAtRisk) return null;
          return (
            <div style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '12px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>🔥</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.78rem', fontWeight: '700', color: '#92400e' }}>Streak at risk!</div>
                <div style={{ fontSize: '.72rem', color: '#78350f' }}>Practice today to keep your {streak}-day streak alive.</div>
              </div>
            </div>
          );
        })()}

        {lang && (() => {
          const sessions = profile?.sessions || 0;
          const level = activeLang?.level || 'beginner';
          const shownKey = `perin_levelup_shown_${lang}_${dialect}_${level}`;
          const alreadyShown = localStorage.getItem(shownKey);
          const thresholds = { beginner: 8, intermediate: 15, advanced: 25 };
          const threshold = thresholds[level];
          if (!threshold || sessions < threshold || alreadyShown || level === 'native') return null;
          return (
            <div style={{ background: 'linear-gradient(135deg,rgba(26,86,219,.08),rgba(26,86,219,.03))', border: '1.5px solid rgba(26,86,219,.2)', borderRadius: '14px', padding: '12px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>🎯</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.78rem', fontWeight: '700', color: 'var(--accent)' }}>Ready to level up?</div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>You've done {sessions} sessions at {level}. Try {level === 'beginner' ? 'intermediate' : level === 'intermediate' ? 'advanced' : 'native'} level.</div>
              </div>
              <button onClick={() => { localStorage.setItem(shownKey, '1'); navigate('/journey'); }} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}>
                Try it →
              </button>
            </div>
          );
        })()}

        {unlockedBanner && (
          <div style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1.5px solid #f59e0b', borderRadius: '14px', padding: '12px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.6rem' }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: '#92400e', marginBottom: '2px' }}>New stage unlocked</div>
              <div style={{ fontSize: '.9rem', fontWeight: '700', color: '#78350f' }}>{unlockedBanner.stage?.label}</div>
            </div>
            <button onClick={dismissUnlockedBanner} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#92400e', padding: '4px' }}>✕</button>
          </div>
        )}

        <DailyMission sessions={profile?.sessions || 0} navigate={navigate} nextJourney={next} />

        {lang && <CultureCard dialect={dialect} lang={lang} />}

        {next && (
          <div className="dash-continue-card" onClick={continueJourney}
            style={{ borderColor: 'var(--accent)', background: 'linear-gradient(135deg,var(--card),rgba(26,86,219,.04))', marginBottom: '10px', cursor: 'pointer' }}>
            <div className="dcc-icon">{next.scenario?.icon || '💬'}</div>
            <div className="dcc-text" style={{ flex: 1, minWidth: 0 }}>
              <div className="dcc-label">{anyDone ? '▶ Continue your journey' : '🚀 Start your first session'}</div>
              <div className="dcc-title">{next.scenario?.title}</div>
              <div className="dcc-sub" style={{ marginTop: '3px' }}>{next.scenario?.desc?.slice(0, 80)}{next.scenario?.desc?.length > 80 ? '…' : ''}</div>
              {stageProgress && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>{stageProgress.label} — {stageProgress.done}/{stageProgress.total} done</span>
                    <span style={{ fontSize: '.65rem', fontWeight: '700', color: 'var(--accent)' }}>{Math.round(stageProgress.done / stageProgress.total * 100)}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stageProgress.done / stageProgress.total * 100}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width .5s' }} />
                  </div>
                </div>
              )}
            </div>
            <span style={{ color: 'var(--accent)', fontSize: '1.2rem', flexShrink: 0 }}>›</span>
          </div>
        )}

        {revisit && revisit.scenario && (
          <div onClick={() => navigate('/wordprep', { state: { scenario: revisit.scenario, level: revisit.level, idx: revisit.idx, lang, dialect } })}
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '12px 16px', marginBottom: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{revisit.scenario.icon || '🔁'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.62rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '2px' }}>🔁 Worth revisiting</div>
              <div style={{ fontSize: '.88rem', fontWeight: '700', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{revisit.scenario.title}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: '1px' }}>You've only done this once — try it again</div>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: '1.1rem', flexShrink: 0 }}>›</span>
          </div>
        )}

        <AddLangPanel onAdd={addLanguage} />

        <div id="lang-cards" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {languages.map((l, i) => (
            <LangCard key={i} lang={l} active={l.lang === lang && l.dialect === dialect} onClick={() => selectLang(l)} />
          ))}
        </div>

        <button className="dash-hero-btn" onClick={() => navigate('/scenarios')}>
          <span className="dmr-icon" style={{ width: '28px', color: '#fff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '700' }}>Start a Conversation</div>
            <div style={{ fontSize: '.78rem', opacity: '.8', marginTop: '2px' }}>Pick a scenario and talk</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '1.2rem', opacity: '.7' }}>›</span>
        </button>

        <div className="dash-mode-list">
          <button className="dash-mode-row" onClick={() => navigate('/scenes')}>
            <span className="dmr-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="m7 2 0 20M17 2v20M2 12h20M2 7h5m10 0h5M2 17h5m10 0h5"/></svg></span>
            <div className="dmr-text"><div className="dmr-label">Scene Mode</div><div className="dmr-sub">Story-driven scenes with emotional stakes — an argument, a job interview, a first date</div></div>
            <span className="dmr-arrow">›</span>
          </button>
          <button className="dash-mode-row" onClick={() => navigate('/pressure')} style={{ borderColor: 'rgba(239,68,68,.25)' }}>
            <span className="dmr-icon" style={{ color: '#ef4444' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></span>
            <div className="dmr-text"><div className="dmr-label">Live Conversation <span style={{ fontSize: '.6rem', background: 'rgba(239,68,68,.15)', color: '#ef4444', borderRadius: '4px', padding: '1px 5px', verticalAlign: 'middle', marginLeft: '4px' }}>BETA</span></div><div className="dmr-sub">AI speaks first, you react in real time — no script</div></div>
            <span className="dmr-arrow" style={{ color: '#ef4444' }}>›</span>
          </button>
          <button className="dash-mode-row" onClick={() => navigate('/srs')}>
            <span className="dmr-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="12" cy="10" r="1"/><circle cx="8" cy="10" r="1"/><circle cx="16" cy="10" r="1"/></svg></span>
            <div className="dmr-text"><div className="dmr-label">My Words</div><div className="dmr-sub">Your saved vocabulary and session phrases — review with spaced repetition</div></div>
            <span className="dmr-arrow">›</span>
          </button>
          <button className="dash-mode-row" onClick={() => navigate('/chat', { state: { mode: 'freechat', lang, dialect } })}>
            <span className="dmr-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
            <div className="dmr-text"><div className="dmr-label">Free Chat</div><div className="dmr-sub">Open conversation on any topic — no scenario, no goal, just talk</div></div>
            <span className="dmr-arrow">›</span>
          </button>
          <button className="dash-mode-row" onClick={() => navigate('/listening')}>
            <span className="dmr-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg></span>
            <div className="dmr-text"><div className="dmr-label">Listen &amp; Respond</div><div className="dmr-sub">A native speaker says something — you transcribe it. Trains your ear for real-speed speech</div></div>
            <span className="dmr-arrow">›</span>
          </button>
        </div>

        <button className="dash-section-toggle" onClick={() => setDrillsOpen(o => !o)}>
          <span>Drills &amp; Quizzes</span>
          <span style={{ transition: 'transform .2s', transform: drillsOpen ? 'rotate(90deg)' : 'none' }}>›</span>
        </button>

        {drillsOpen && (
          <div className="dash-mode-list" style={{ marginTop: 0, borderTop: 'none', borderRadius: '0 0 14px 14px' }}>
            {[
              { label: 'Fill the Blank', sub: 'Fill in the missing word from a real sentence', path: '/fib' },
              { label: 'Culture Quiz', sub: 'One daily question about customs, slang, or culture', path: '/vocab-quiz' },
              { label: 'Native Ear', sub: 'Hear how locals actually say it', path: '/dialect-decoder' },
              { label: 'Vocab Review', sub: 'Spaced repetition for saved words', path: '/srs' },
              { label: 'Sentence Builder', sub: 'Drag words into the right order', path: '/sentence-builder' },
              { label: 'Reading', sub: 'A short authentic text — read it, then answer a question', path: '/reading' },
              { label: 'Listening', sub: 'A native speaker says something — you transcribe it', path: '/listening' },
            ].map(({ label, sub, path }) => (
              <button key={path} className="dash-mode-row" onClick={() => navigate(path)}>
                <div className="dmr-text"><div className="dmr-label">{label}</div><div className="dmr-sub">{sub}</div></div>
                <span className="dmr-arrow">›</span>
              </button>
            ))}
          </div>
        )}

        {languages.length >= 2 && <ConnectionsPanel languages={languages} />}

      </div>
    </div>
  );
}
