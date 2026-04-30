import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

const SCENES = [
  { icon: '💔', title: 'Breaking Up in a Café', desc: "You have to end a relationship — in the target language. They don't take it well. The conversation is emotional, messy, and completely unscripted.", mood: 'tense', moodLabel: '😬 Tense' },
  { icon: '🎂', title: 'Surprise Birthday Gone Wrong', desc: "You planned a surprise party but the guest of honour found out. Now you're explaining yourself to their entire family — in the target language.", mood: 'awkward', moodLabel: '😅 Awkward' },
  { icon: '✈️', title: 'Missed Your Flight', desc: "You're at the airport. Your flight left 10 minutes ago. You have to talk to the airline desk, explain what happened, and negotiate a solution.", mood: 'tense', moodLabel: '😬 Tense' },
  { icon: '💍', title: 'Meeting the Parents for the First Time', desc: "Your partner's parents speak no English. Dinner is tonight. You need to make a great impression and answer a lot of very personal questions.", mood: 'awkward', moodLabel: '😅 Awkward' },
  { icon: '🎉', title: 'Getting a Job Offer', desc: "You just got called with a job offer — in the target language. You need to negotiate salary, ask about benefits, and accept gracefully.", mood: 'exciting', moodLabel: '🎉 Exciting' },
  { icon: '🚔', title: 'Stopped by the Police', desc: "A routine stop. The officer asks for your documents, where you're going, what you were doing. You stay calm and navigate it entirely in the local language.", mood: 'tense', moodLabel: '😬 Tense' },
  { icon: '🏘️', title: 'Loud Neighbour Confrontation', desc: "It's midnight. The neighbour upstairs is having a party again. You knock on the door and have to politely — then firmly — ask them to keep it down.", mood: 'awkward', moodLabel: '😅 Awkward' },
  { icon: '🤒', title: 'Calling in Sick to Work', desc: "You need to call your boss and explain you're too ill to come in. They're not thrilled. You have to be convincing, apologetic, and professional.", mood: 'serious', moodLabel: '😐 Serious' },
  { icon: '🛍️', title: 'Returning a Broken Item', desc: "You bought something that stopped working after one day. You're back at the shop. The owner is skeptical. You stand your ground and demand a refund.", mood: 'tense', moodLabel: '😬 Tense' },
  { icon: '🌹', title: 'Asking Someone Out', desc: "You've been building up the courage. The moment is now. You ask someone out — in the target language — and handle whatever answer they give.", mood: 'exciting', moodLabel: '🎉 Exciting' },
  { icon: '🎓', title: 'Defending Your Thesis', desc: "Your committee asks tough questions about your research. You have to think fast, explain clearly, and handle a challenge to your methodology.", mood: 'serious', moodLabel: '😐 Serious' },
  { icon: '🏨', title: 'Wrong Hotel Room', desc: "You've been checked into a smoking room when you booked non-smoking. The front desk says it's fully booked. You don't accept that.", mood: 'tense', moodLabel: '😬 Tense' },
  { icon: '🏥', title: 'Medical Emergency', desc: "Someone collapses near you. You need to call for help, describe what happened, and stay calm under pressure.", mood: 'tense', moodLabel: '🚨 High Stakes' },
  { icon: '🤥', title: 'Catching Someone in a Lie', desc: "You've realized a friend or colleague hasn't been honest with you. You confront them — carefully, but directly.", mood: 'tense', moodLabel: '😬 Tense' },
  { icon: '🏠', title: 'Moving In With a Stranger', desc: "First day living with a new roommate. You need to set expectations, be friendly, and navigate the awkward first conversation.", mood: 'awkward', moodLabel: '😅 Awkward' },
  { icon: '🎂', title: 'Forgetting an Important Date', desc: "You completely forgot a friend's birthday or anniversary. They know. You have to apologize and make it right.", mood: 'awkward', moodLabel: '😅 Awkward' },
  { icon: '✈️', title: 'Lost at the Airport', desc: "Your connecting flight was missed, your bag is lost, and the airline desk person isn't being helpful. Handle it.", mood: 'tense', moodLabel: '🚨 High Stakes' },
  { icon: '💼', title: 'Being Fired', desc: "Your boss calls you in. The news isn't good. You have to respond with composure, ask the right questions, and leave with dignity.", mood: 'serious', moodLabel: '😐 Serious' },
  { icon: '🚑', title: 'Car Accident', desc: "A minor fender bender. Nobody's hurt but you need to exchange information, deal with the other driver, and possibly call police.", mood: 'tense', moodLabel: '🚨 High Stakes' },
  { icon: '💍', title: 'Unexpected Proposal', desc: "Someone you've been dating proposes — or you're proposing. The emotional stakes are real. Handle it naturally.", mood: 'warm', moodLabel: '💕 Emotional' },
];

const MOOD_CLASS = {
  tense: 'mood-tense',
  warm: 'mood-warm',
  awkward: 'mood-awkward',
  exciting: 'mood-exciting',
  serious: 'mood-serious',
};

export default function Scenes() {
  const { state } = useApp();
  const navigate = useNavigate();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || '';
  const dialect    = activeLang?.dialect || lang;
  const level      = activeLang?.level   || 'intermediate';
  const xp         = activeLang?.xp      || 0;

  function startScene(scene) {
    if (!lang) {
      navigate('/dashboard');
      return;
    }

    // Track replays for variation
    const replayKey = `perin_scene_replay_${lang}_${dialect || lang}_${scene.title}`;
    const replayCount = parseInt(localStorage.getItem(replayKey) || '0');
    localStorage.setItem(replayKey, String(replayCount + 1));

    navigate('/chat', {
      state: {
        lang,
        dialect,
        level,
        mode: 'scene',
        scenario: {
          title: scene.title,
          desc: scene.desc,
          xp: 90,
          replayCount,
        },
      },
    });
  }

  return (
    <div className="screen active" id="screen-scenes" style={{ alignItems: 'center', padding: '16px 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: '760px' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>
            🎬 Scene Mode
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem', lineHeight: 1.5 }}>
            Story-driven scenes with emotional stakes — an argument, a job interview, a first date. No script. Just you.
          </p>
        </div>

        {/* No language warning */}
        {!lang && (
          <div style={{ background: 'var(--cream)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 20, fontSize: '.85rem', color: 'var(--muted)' }}>
            Add a language from the Dashboard to start a scene.
          </div>
        )}

        {/* Grid */}
        <div className="scenes-grid">
          {SCENES.map((scene, i) => (
            <div
              key={i}
              className="scene-card"
              onClick={() => startScene(scene)}
              style={{ cursor: lang ? 'pointer' : 'default', opacity: lang ? 1 : 0.5 }}
            >
              <div className="scene-icon">{scene.icon}</div>
              <h4>{scene.title}</h4>
              <p>{scene.desc}</p>
              <span className={`scene-mood ${MOOD_CLASS[scene.mood] || 'mood-tense'}`}>
                {scene.moodLabel}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
