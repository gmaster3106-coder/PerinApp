export const ELEVENLABS_VOICES = {
  'Dominican Republic': { female: 'IeiHyO4UwOOUdKQ0HSDK', male: '2vyVHGyPYK7eCnfdVvk9' },
  'Puerto Rico':        { female: 'Y6B7kfk4Eyet3NowpN3g', male: 'zwDSHuqO0tEVwNUuHmR1' },
  'Colombia':           { female: 'VmejBeYhbrcTPwDniox7', male: 'PltXjU3hWkDRqpu9TowY' },
  'Mexico':             { female: 'spPXlKT5a4JMfbhPRAzA', male: 'gbTn1bmCvNgk0QEAVyfM' },
  'Castilian':          { female: 'dNjJKg63Fr5AXwIdkATa', male: '5IDdqnXnlsZ1FCxoOFYg' },
  'Spanish':            { female: 'IeiHyO4UwOOUdKQ0HSDK', male: 'IoWn77TsmQnza94sYlfg' },
  'Sicilian':           { female: '8KInRSd4DtD5L5gK7itu', male: '4YsN90HrCPrOCmBglwMA' },
  'Neapolitan':         { female: '8KInRSd4DtD5L5gK7itu', male: '4YsN90HrCPrOCmBglwMA' },
  'Italian':            { female: 'RXoaSpLaWTEckJgPUBG3', male: 'Yb9rQITgCX1VdXgAkbjM' },
  'Parisian':           { female: 'O31r762Gb3WFygrEOGh0', male: 'AfbuxQ9DVtS4azaxN1W7' },
  'Southern French':    { female: 'O31r762Gb3WFygrEOGh0', male: 'AfbuxQ9DVtS4azaxN1W7' },
  'French':             { female: '5OnMHwgTFgvPVwE8jP6B', male: 'OSc8NW5kpGzPyeZB3Wjq' },
  'Portugal':           { female: 'IZipF5JhqPlWzpduTV0E', male: 'c0rzOw18hxEhaSybUod2' },
  'European':           { female: 'IZipF5JhqPlWzpduTV0E', male: 'c0rzOw18hxEhaSybUod2' },
  'Brazilian':          { female: '7iqXtOF3wl3pomwXFY7G', male: 'xNGAXaCH8MaasNuo7Hr7' },
  'Portuguese':         { female: '7iqXtOF3wl3pomwXFY7G', male: 'xNGAXaCH8MaasNuo7Hr7' },
  'American':           { female: 'Hh0rE70WfnSFN80K8uJC', male: 'sB7vwSCyX0tQmU24cW2C' },
  'English':            { female: 'Hh0rE70WfnSFN80K8uJC', male: 'sB7vwSCyX0tQmU24cW2C' },
  'Haiti':              { female: 'mCWIy5g8j7BDSKLtsYz0', male: 'PEjMkBhSB6492eADs4Ew' },
  'Creole':             { female: 'mCWIy5g8j7BDSKLtsYz0', male: 'PEjMkBhSB6492eADs4Ew' },
};

const FEMALE_SCENARIOS = ['coffee','café','cafe','barista','nurse','receptionist','market','pharmacy','hair','spa','checkout','teacher','librarian','neighbor','airbnb','host','doctor','appointment','symptoms','family','mother','sister','daughter','proposal','birthday','breaking up','shopping','apartment','cooking','surprise'];
const MALE_SCENARIOS = ['police','officer','boss','mechanic','taxi','driver','bartender','bouncer','coach','security','job interview','business','negotiating','haggling','bank','fired','car accident','stopped by','argument','confrontation','repair'];

export function getVoiceId(dialect, lang, scenarioTitle = '') {
  const scenario = (scenarioTitle || '').toLowerCase();
  let gender = 'female';
  if (MALE_SCENARIOS.some(k => scenario.includes(k))) gender = 'male';
  else if (FEMALE_SCENARIOS.some(k => scenario.includes(k))) gender = 'female';
  else {
    const last = localStorage.getItem('perin_last_voice_gender') || 'male';
    gender = last === 'male' ? 'female' : 'male';
    localStorage.setItem('perin_last_voice_gender', gender);
  }

  let voices = ELEVENLABS_VOICES[dialect] || ELEVENLABS_VOICES[lang];
  if (!voices && dialect) {
    const dl = dialect.toLowerCase();
    for (const [key, val] of Object.entries(ELEVENLABS_VOICES)) {
      if (dl.includes(key.toLowerCase()) || key.toLowerCase().includes(dl)) {
        voices = val; break;
      }
    }
  }
  if (!voices) {
    const fallbacks = { French: 'French', Italian: 'Italian', Portuguese: 'Portuguese', Spanish: 'Spanish', English: 'English', Creole: 'Creole' };
    voices = ELEVENLABS_VOICES[fallbacks[lang]] || ELEVENLABS_VOICES['English'];
  }
  return voices[gender] || voices['female'] || voices['male'] || null;
}
