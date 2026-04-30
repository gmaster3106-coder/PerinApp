export const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';
export const SUPABASE_URL = 'https://lvwoxdzzbnpzhwbwyfdr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2d294ZHp6YnBuemh3Ynd5ZmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTczNDgsImV4cCI6MjA5MDEzMzM0OH0.1iZpPbeCO924-0fHs8zzeJE-Iqkvv3DY9b2PvPOViLE';
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TLtAxPURe1PE0b6qm77i0hXuNfg9nEtUsQfcQxJNJeh7nVVrmFLGKRdgmC5I35mOr5fiUMyoaLN8baHq0cx3YL700jd4m5NOU';

export const FREE_CONVERSATION_LIMIT = 5;
export const FREE_DRILL_LIMIT = 5;

// Safari/iOS detection
export const isSafariIOS = /iP(hone|ad|od)/.test(navigator.userAgent) && /WebKit/.test(navigator.userAgent) && !/CriOS/.test(navigator.userAgent);
export const isSafariDesktop = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && !isSafariIOS;
export const isAnySafari = isSafariIOS || isSafariDesktop;

export const SCRIPT_TYPES = {
  'Spanish': 'latin', 'Portuguese': 'latin', 'French': 'latin',
  'Italian': 'latin', 'German': 'latin', 'Dutch': 'latin',
  'Haitian Creole': 'latin', 'Greek': 'greek', 'Russian': 'cyrillic',
  'Arabic': 'arabic', 'Hebrew': 'hebrew', 'Chinese': 'logographic',
  'Japanese': 'logographic', 'Korean': 'korean', 'Hindi': 'devanagari',
};

export const LANG_CODES = {
  'Spanish':'es-ES','Portuguese':'pt-PT','French':'fr-FR','Italian':'it-IT',
  'German':'de-DE','Dutch':'nl-NL','Haitian Creole':'ht-HT',
};

export const DIALECT_CODES = {
  'Mexican':'es-MX','Dominican Republic':'es-DO','Puerto Rico':'es-PR',
  'Colombian':'es-CO','Cuban':'es-CU','Castilian':'es-ES','Argentine':'es-AR',
  'Parisian':'fr-FR','Southern French':'fr-FR',
  'Brazilian':'pt-BR','Portugal':'pt-PT',
  'Sicilian':'it-IT','Neapolitan':'it-IT',
};

export const AVATAR_COLORS = [
  {bg:'#1a56db',fg:'#fff'},{bg:'#f5c400',fg:'#0a1a3a'},
  {bg:'#059669',fg:'#fff'},{bg:'#dc2626',fg:'#fff'},
  {bg:'#7c3aed',fg:'#fff'},{bg:'#ea580c',fg:'#fff'},
  {bg:'#0891b2',fg:'#fff'},{bg:'#be185d',fg:'#fff'},
];

export const ACCENT_THEMES = [
  {id:'blue',   label:'Ocean',    accent:'#1a56db', header:'#0a1a3a'},
  {id:'purple', label:'Violet',   accent:'#7c3aed', header:'#1e1b4b'},
  {id:'green',  label:'Forest',   accent:'#059669', header:'#022c22'},
  {id:'orange', label:'Sunset',   accent:'#ea580c', header:'#431407'},
  {id:'rose',   label:'Rose',     accent:'#e11d48', header:'#4c0519'},
  {id:'teal',   label:'Teal',     accent:'#0891b2', header:'#082f49'},
  {id:'gold',   label:'Gold',     accent:'#b45309', header:'#1c1007'},
  {id:'slate',  label:'Slate',    accent:'#475569', header:'#0f172a'},
];
