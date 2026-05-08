import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useTTS } from '../hooks/useTTS.js';
import { getLangCode } from '../utils/langUtils.js';
import { getValidToken } from '../utils/getValidToken.js';

const WORKER_URL = 'https://perin-proxy.gmaster3106.workers.dev';

// ─── Dialect data ─────────────────────────────────────────────────────────────
const DIALECT_DECODER = {
  'Caribbean Spanish': {
    dialects: ['Dominican Republic','Puerto Rico','Cuba','Venezuela','Panama'],
    color: '#1a56db', flag: '🏝️',
    intro: 'Caribbean Spanish is fast, musical, and drops sounds that other Spanish speakers keep. If standard Spanish sounds like a clear river, Caribbean Spanish sounds like the ocean — fluid, rhythmic, and full of shortcuts.',
    features: [
      { title: 'Final -s is dropped or aspirated', icon: '💨',
        rule: 'The "s" at the end of words becomes a breath (aspiration) or disappears entirely.',
        examples: [
          { standard: 'nosotros', local: 'nosotro(h)', meaning: 'we' },
          { standard: 'estás bien', local: 'ehtá bien / etá bien', meaning: "you're fine" },
          { standard: 'los niños', local: 'loh niño / lo niño', meaning: 'the children' },
          { standard: 'más o menos', local: 'máh o menoh', meaning: 'more or less' },
        ],
        note: "This is THE defining feature of Caribbean Spanish. In the DR it's often a full drop; in Puerto Rico it becomes a soft 'h' sound." },
      { title: 'R sounds like L (and vice versa)', icon: '🔄',
        rule: 'In many Caribbean dialects, especially Dominican and Puerto Rican, -r at the end of syllables can sound like -l, and -l can sound like -r.',
        examples: [
          { standard: 'puerta', local: 'puelta', meaning: 'door (DR)' },
          { standard: 'comer', local: 'comel', meaning: 'to eat (DR)' },
          { standard: 'Puerto Rico', local: 'Puelto Rico', meaning: 'Puerto Rico (DR accent)' },
          { standard: 'alma', local: 'arma', meaning: 'soul (PR variation)' },
        ],
        note: 'This is especially strong in Dominican Spanish. Puerto Rican Spanish often turns -r into an "l" sound at syllable ends.' },
      { title: 'Intervocalic -d- disappears', icon: '🕳️',
        rule: 'The "d" between vowels weakens and often disappears completely in informal speech.',
        examples: [
          { standard: 'todo', local: "to'o / too", meaning: 'everything' },
          { standard: 'nada', local: "na'a / naa", meaning: 'nothing' },
          { standard: 'helado', local: 'helao', meaning: 'ice cream' },
          { standard: 'pescado', local: 'pescao', meaning: 'fish (cooked)' },
        ],
        note: "You'll hear this everywhere in casual conversation. 'Pescao' and 'pescado' are the same word — one is relaxed, one is formal." },
      { title: 'Inverted question word order', icon: '🔀',
        rule: 'Caribbean Spanish often uses subject-verb-question-word order instead of inverting.',
        examples: [
          { standard: '¿Cómo te llamas?', local: '¿Cómo tú te llamas?', meaning: "What's your name?" },
          { standard: '¿Dónde vas?', local: '¿Dónde tú vas?', meaning: 'Where are you going?' },
          { standard: '¿Qué quieres?', local: '¿Qué tú quieres?', meaning: 'What do you want?' },
        ],
        note: 'Inserting the subject pronoun between the question word and verb is distinctly Caribbean. Elsewhere in Spanish this sounds very unusual.' },
      { title: 'Speed and contraction', icon: '⚡',
        rule: 'Caribbean speech is fast. Multiple words blur together. "Para" becomes "pa\'", "para acá" becomes "pacá".',
        examples: [
          { standard: 'para allá', local: 'pallá', meaning: 'over there' },
          { standard: 'para acá', local: 'pacá', meaning: 'over here' },
          { standard: 'para qué', local: "pa'qué", meaning: 'what for' },
          { standard: 'ahora mismo', local: 'ahorita / orita', meaning: 'right now' },
        ],
        note: "Don't be discouraged if Caribbean Spanish is hard to understand at first — even other Spanish speakers say the same." },
    ],
  },
  'Mexican Spanish': {
    dialects: ['Mexico','Mexican'], color: '#2e7d32', flag: '🇲🇽',
    intro: "Mexican Spanish is clear, rhythmic, and keeps most consonants that other dialects drop. It's often called the most 'neutral' Spanish, but it has its own rich features — especially in indigenous-influenced vocabulary and intonation.",
    features: [
      { title: 'Clear consonants — nothing dropped', icon: '🔊',
        rule: 'Unlike Caribbean Spanish, Mexican Spanish keeps final -s, intervocalic -d-, and most consonants crisp and clear.',
        examples: [
          { standard: 'nosotros', local: 'nosotros', meaning: 'we (fully pronounced)' },
          { standard: 'nada', local: 'nada', meaning: 'nothing (d clearly heard)' },
          { standard: 'más', local: 'más', meaning: 'more (s clearly heard)' },
        ],
        note: 'This is why Mexican Spanish is often used in Latin American TV and radio — it\'s highly intelligible to all Spanish speakers.' },
      { title: 'Nahuatl-origin vocabulary', icon: '🌽',
        rule: 'Hundreds of everyday Mexican Spanish words come from Nahuatl, the Aztec language.',
        examples: [
          { standard: 'aguacate', local: 'aguacate', meaning: 'avocado (from Nahuatl ahuacatl)' },
          { standard: 'chocolate', local: 'chocolate', meaning: 'chocolate (from Nahuatl xocolatl)' },
          { standard: 'chile', local: 'chile', meaning: 'chili pepper (from Nahuatl chilli)' },
          { standard: 'tomate', local: 'tomate', meaning: 'tomato (from Nahuatl tomatl)' },
        ],
        note: 'When you eat guacamole or call someone a "maje" — you\'re speaking Nahuatl-influenced Spanish.' },
      { title: 'Diminutives everywhere', icon: '🤏',
        rule: 'Mexicans use -ito/-ita diminutives far more than other Spanish speakers — not just for size but for warmth and softening requests.',
        examples: [
          { standard: 'un momento', local: 'un momentito', meaning: 'one moment (softer, warmer)' },
          { standard: 'espera', local: 'esperita', meaning: 'wait (gentle request)' },
          { standard: 'ahorita', local: 'ahorita', meaning: 'right now (could mean never!)' },
          { standard: 'un taco', local: 'un taquito', meaning: 'a taco (affectionate)' },
        ],
        note: '"Ahorita" is famously ambiguous — technically "right now" but in practice anywhere from 5 minutes to never.' },
      { title: 'Unique Mexican slang', icon: '🌮',
        rule: 'Mexican Spanish has a rich slang vocabulary that differs significantly from other dialects.',
        examples: [
          { standard: '¿Qué tal?', local: '¿Qué onda?', meaning: "What's up?" },
          { standard: 'amigo', local: 'güey / wey', meaning: 'dude/man (ubiquitous)' },
          { standard: 'genial', local: 'chido/chida', meaning: 'cool/great' },
          { standard: 'dinero', local: 'lana / feria', meaning: 'money (slang)' },
        ],
        note: '"Güey" is used so constantly it\'s almost punctuation. Hearing it from strangers can still be risky — context is everything.' },
    ],
  },
  'Colombian Spanish': {
    dialects: ['Colombia','Colombian','Bogotano','Paisa'], color: '#fdcb6e', flag: '🇨🇴',
    intro: 'Colombian Spanish varies dramatically by region — Bogotá is considered among the clearest Spanish in Latin America, while Costeño sounds much more like Caribbean Spanish, and Paisa (Medellín) has its own distinct music.',
    features: [
      { title: 'Bogotano — the "neutral" accent', icon: '🏙️',
        rule: 'Bogotá Spanish keeps all consonants clear, uses formal usted even between friends, and has precise pronunciation.',
        examples: [
          { standard: 'tú eres', local: 'usted es', meaning: 'you are (formal "you" used informally)' },
          { standard: '¿Cómo estás?', local: '¿Cómo está usted?', meaning: 'How are you? (Bogotá formality)' },
          { standard: 'mamá', local: 'mamacita / ma', meaning: 'mom (affectionate terms)' },
        ],
        note: 'Using "usted" with your partner, friends, or even children is common and affectionate in Bogotá — the opposite of formal.' },
      { title: 'Paisa accent (Medellín/Antioquia)', icon: '🌸',
        rule: 'Paisas have a distinctly musical, singsong accent with rising intonation. Warm, talkative, expressive.',
        examples: [
          { standard: 'amigo', local: 'parce / parcero', meaning: 'friend/buddy (Paisa slang)' },
          { standard: 'genial', local: 'bacano/bacana', meaning: 'cool/great (very Paisa)' },
          { standard: 'hombre', local: 'marica', meaning: 'dude (affectionate, NOT an insult between friends)' },
          { standard: 'muy bien', local: 'qué chimba', meaning: 'how great (strong Paisa slang)' },
        ],
        note: '"Marica" in Paisa culture is a deeply affectionate term between close friends — completely different from its meaning elsewhere.' },
      { title: 'Costeño accent (Caribbean coast)', icon: '🌊',
        rule: 'Caribbean-coast Colombians share many features with Caribbean Spanish — dropped -s, fast pace.',
        examples: [
          { standard: 'estamos', local: 'etamo(h)', meaning: 'we are (s dropped)' },
          { standard: '¿qué más?', local: '¿epa, qué má?', meaning: "what's up? (Costeño greeting)" },
          { standard: 'hermano', local: 'mano', meaning: 'bro (shortened)' },
        ],
        note: 'Costeño Spanish sounds much closer to Dominican or Puerto Rican Spanish than to Bogotá. Colombia contains multitudes.' },
    ],
  },
  'Castilian Spanish': {
    dialects: ['Spain','Castilian','Madrid','Peninsular'], color: '#e17055', flag: '🇪🇸',
    intro: 'Castilian Spanish is where most textbooks start, but real spoken Spanish in Madrid is full of features that confuse learners: the famous "theta" sound, vosotros, and a very different rhythm from Latin American Spanish.',
    features: [
      { title: 'The "theta" — c and z sound like "th"', icon: '👅',
        rule: 'In Castilian Spanish, c (before e/i) and z are pronounced like the English "th" in "think" — not like "s" as in Latin America.',
        examples: [
          { standard: 'gracias (Latin Am: grasias)', local: 'gracias (gra-THIAS)', meaning: 'thank you' },
          { standard: 'cerveza (serbesa)', local: 'cerveza (ther-VE-tha)', meaning: 'beer' },
          { standard: 'zapato (sapato)', local: 'zapato (tha-PA-to)', meaning: 'shoe' },
          { standard: 'Barcelona (barselo-na)', local: 'Barcelona (barthelona)', meaning: 'Barcelona' },
        ],
        note: 'This is NOT a lisp. It\'s a distinct phoneme. The myth that it originated from a lisping king is false.' },
      { title: '"Vosotros" — the plural you', icon: '👥',
        rule: 'Spain uses "vosotros" for the informal plural "you." This pronoun doesn\'t exist in Latin America, which uses "ustedes" for everything.',
        examples: [
          { standard: 'ustedes son (Latin Am)', local: 'vosotros sois', meaning: 'you all are' },
          { standard: '¿qué quieren?', local: '¿qué queréis?', meaning: 'what do you (all) want?' },
        ],
        note: 'If you learned Spanish in Latin America, vosotros conjugations will feel completely foreign. They\'re not hard — just unfamiliar.' },
      { title: 'Spain-specific slang', icon: '🎸',
        rule: 'Spanish slang from Spain is immediately recognizable and largely incomprehensible to Latin Americans.',
        examples: [
          { standard: 'amigo', local: 'tío/tía', meaning: 'dude/girl (used constantly)' },
          { standard: 'genial', local: 'guay / mola mucho', meaning: "cool / it's great" },
          { standard: '¿en serio?', local: 'hostia / ostras', meaning: 'wow/seriously (exclamation)' },
        ],
        note: '"Tío" is so embedded in Spanish speech it\'s barely noticed. Using it in Mexico will immediately mark you as from Spain.' },
    ],
  },
  'Brazilian Portuguese': {
    dialects: ['Brazil','Brazilian','Carioca'], color: '#00b894', flag: '🇧🇷',
    intro: 'Brazilian Portuguese sounds so different from European Portuguese that speakers sometimes struggle to understand each other. Brazilian is open, vowel-rich, and musical. Most learners find Brazilian far easier to understand.',
    features: [
      { title: 'Open vowels vs. swallowed vowels', icon: '👄',
        rule: 'Brazilian Portuguese fully pronounces most vowels. European Portuguese reduces unstressed vowels to near-silence.',
        examples: [
          { standard: 'obrigado (European: obrigadu)', local: 'obrigado (full -ado)', meaning: 'thank you' },
          { standard: 'Portugal (European: Purtugal)', local: 'Portugal (Por-tu-GAL)', meaning: 'Portugal' },
        ],
        note: 'European Portuguese swallows unstressed vowels so completely that Brazilians sometimes say it sounds like Russian.' },
      { title: 'Gíria (Brazilian slang)', icon: '🎵',
        rule: 'Brazilian informal speech is full of slang that European Portuguese speakers don\'t use or understand.',
        examples: [
          { standard: 'legal', local: 'legal', meaning: 'cool/great (the #1 Brazilian compliment)' },
          { standard: 'cara', local: 'cara', meaning: 'dude (literally "face")' },
          { standard: 'tá bom', local: 'tá', meaning: 'okay (ultra-shortened)' },
          { standard: 'saudade', local: 'saudade', meaning: 'that bittersweet longing (untranslatable)' },
        ],
        note: '"Tá" (from "está") is the most compressed word in Brazilian Portuguese. Blink and you\'ll miss it.' },
    ],
  },
  'European Portuguese': {
    dialects: ['Portugal','European Portuguese','Lisbon','Porto'], color: '#0984e3', flag: '🇵🇹',
    intro: 'European Portuguese swallows unstressed vowels almost entirely, speaks at a clipped pace, and has a rhythm that sounds more Slavic than Latin to untrained ears. Most learners find Brazilian far easier to start with.',
    features: [
      { title: 'Unstressed vowels are swallowed', icon: '🕳️',
        rule: 'Unstressed vowels — especially "e" and "o" — are reduced to near-silence or completely swallowed.',
        examples: [
          { standard: 'bom dia (Brazilian: bom JEE-ah)', local: 'bom dia (European: bm-JEE-ah)', meaning: 'good morning — the "o" nearly disappears' },
          { standard: 'obrigado (oh-bree-GAH-doh)', local: 'obrigado (obr-GAH-doo)', meaning: 'thank you — vowels reduced' },
        ],
        note: 'Brazilians say European Portuguese sounds like Russian because of the consonant-heavy reduced speech pattern.' },
      { title: 'Fixe, bué — distinctly Portuguese slang', icon: '🗝️',
        rule: 'European Portuguese has its own slang that Brazilians don\'t recognize.',
        examples: [
          { standard: 'legal/bacana (Brazilian)', local: 'fixe', meaning: 'cool/great — ONLY in Portugal' },
          { standard: 'muito (standard)', local: 'bué', meaning: 'very/a lot — Lisbon slang' },
          { standard: 'cara/mano (Brazilian)', local: 'gajo/gaja', meaning: 'guy/girl — casual address' },
        ],
        note: '"Desenrascanço" — the Portuguese art of creatively solving problems — has no equivalent word in Brazilian.' },
    ],
  },
  'Parisian French': {
    dialects: ['French','Parisian','Paris','France'], color: '#2563eb', flag: '🇫🇷',
    intro: 'Parisian French is famous for being fast, nasal, and full of liaisons that beginners miss entirely. Textbook French is clear — Parisian French is fluid, contracted, and sounds almost like one long word.',
    features: [
      { title: 'Liaison — words blur together', icon: '🔗',
        rule: 'When a word ending in a consonant is followed by a vowel, the consonant carries over. This happens constantly.',
        examples: [
          { standard: 'les amis', local: 'lé-z-ami', meaning: 'the friends' },
          { standard: 'vous avez', local: 'vou-z-avez', meaning: 'you have' },
          { standard: 'comment allez-vous', local: 'koman-t-alevoo', meaning: 'how are you' },
        ],
        note: 'Liaison is why French sounds like one continuous stream. Miss the liaisons and you sound like you\'re reading word by word.' },
      { title: 'Ne is dropped in speech', icon: '✂️',
        rule: 'In spoken Parisian French, the "ne" in negation almost always disappears.',
        examples: [
          { standard: 'Je ne sais pas', local: 'Je sais pas / Chais pas', meaning: "I don't know" },
          { standard: "Ce n'est pas vrai", local: "C'est pas vrai", meaning: "That's not true" },
          { standard: 'Je ne vais pas', local: 'Je vais pas', meaning: "I'm not going" },
        ],
        note: '"Chais pas" is one of the most common phrases in French conversation. The full form sounds formal.' },
      { title: 'Tu → t\' and contractions everywhere', icon: '⚡',
        rule: 'In fast Parisian speech, subject pronouns get swallowed.',
        examples: [
          { standard: 'Tu as compris?', local: "T'as compris?", meaning: 'Did you understand?' },
          { standard: 'Il y a', local: "Y'a", meaning: 'There is/are' },
          { standard: 'Je ne sais pas', local: 'Chais pas', meaning: "I don't know" },
        ],
        note: '"Y\'a" (from "il y a") is everywhere. "Y\'a pas de problème" = no problem.' },
    ],
  },
  'Southern French': {
    dialects: ['Southern French','Provence','Marseille','South of France'], color: '#d97706', flag: '🇫🇷',
    intro: 'Southern French (le français du Midi) is warmer, slower, and more open than Parisian French. The accent is immediately recognizable — vowels are rounder, final E sounds are pronounced, and the rhythm has a Mediterranean unhurriedness.',
    features: [
      { title: 'Final E is pronounced', icon: '🔊',
        rule: 'Where Parisians drop the final E in words, Southerners pronounce it — giving speech a melodic, open quality.',
        examples: [
          { standard: 'une femme (Parisian: "un femm")', local: 'une femm-uh', meaning: 'a woman' },
          { standard: 'tu parles (Parisian: "tu parl")', local: 'tu parl-uh', meaning: 'you speak' },
          { standard: "c'est une belle chose", local: 'say-t-une bell-uh chose-uh', meaning: "it's a beautiful thing" },
        ],
        note: 'This is the most recognizable feature of the Midi accent. It gives Southern French its sing-song quality.' },
      { title: 'Occitan vocabulary', icon: '🏛️',
        rule: 'Southern French vocabulary carries traces of Occitan — the medieval language of troubadours.',
        examples: [
          { standard: 'adieu (formal farewell)', local: 'adieu (casual greeting in Provence)', meaning: 'hello AND goodbye' },
          { standard: 'beaucoup (a lot)', local: 'vachement', meaning: 'a lot, really' },
        ],
        note: '"Adieu" as a casual greeting shocks Parisians — in standard French it means a final farewell. In Provence, it\'s just "hi."' },
    ],
  },
  'Italian': {
    dialects: ['Italian','Italy','Rome','Milan'], color: '#16a34a', flag: '🇮🇹',
    intro: 'Standard Italian is one of the clearest Romance languages — but spoken Italian still has rhythms, double consonants, and regional colorings that textbooks miss.',
    features: [
      { title: 'Double consonants change meaning', icon: '✌️',
        rule: 'Italian double consonants are held slightly longer and completely change word meaning.',
        examples: [
          { standard: 'pala (shovel)', local: 'palla (ball)', meaning: 'one L vs two L' },
          { standard: 'nono (ninth)', local: 'nonno (grandfather)', meaning: 'one N vs two N' },
          { standard: 'sera (evening)', local: 'serra (greenhouse)', meaning: 'one R vs two R' },
        ],
        note: 'Double consonants are a physical pause — you hold the sound. Practice with "pizza" — the double Z is a real held sound.' },
      { title: 'Allora — the Swiss army word', icon: '🗡️',
        rule: '"Allora" means then/so/well but is used constantly as a pause filler and transition word.',
        examples: [
          { standard: 'So...', local: 'Allora...', meaning: 'Starting any sentence' },
          { standard: 'Well then', local: 'Allora!', meaning: 'Settling something' },
          { standard: 'So what?', local: 'E allora?', meaning: 'Challenging someone' },
        ],
        note: 'A teacher beginning a lesson, a waiter taking your order — they all say "allora." Master this and you sound instantly more natural.' },
    ],
  },
  'Neapolitan': {
    dialects: ['Neapolitan','Naples','Napoli'], color: '#ea580c', flag: '🌋',
    intro: "Neapolitan is not a dialect of Italian — it's a separate language with its own literature, opera, and grammar. Modern Neapolitans mix Neapolitan features into Italian constantly.",
    features: [
      { title: 'Final vowels drop completely', icon: '✂️',
        rule: 'In Neapolitan, words often lose their final vowel entirely — faster and more rhythmic than standard Italian.',
        examples: [
          { standard: 'pane', local: "pan'", meaning: 'bread' },
          { standard: 'come stai?', local: "com' sta'?", meaning: 'how are you?' },
          { standard: 'bello', local: "bell'", meaning: 'beautiful' },
        ],
        note: "This isn't laziness — it's a systematic phonological feature of the Neapolitan language." },
      { title: 'Distinct Neapolitan vocabulary', icon: '🗝️',
        rule: 'Many everyday Neapolitan words are completely different from standard Italian.',
        examples: [
          { standard: 'amico', local: 'guagliò', meaning: 'friend/guy (vocative address)' },
          { standard: 'bambino', local: 'guaglione', meaning: 'boy/kid' },
          { standard: 'molto bene', local: "a' posto", meaning: 'all good / fine' },
        ],
        note: '"Guagliò" is the defining Neapolitan address — shouted across streets, used between friends. Hearing it means you\'re in Naples.' },
      { title: 'The gesture language', icon: '🤌',
        rule: 'Neapolitan communication is inseparable from gesture.',
        examples: [
          { standard: 'Non lo so', local: '(shrug + upturned hand)', meaning: "I don't know" },
          { standard: 'Non me ne frega', local: '(chin flick)', meaning: "I don't care" },
          { standard: 'Piano piano', local: '(palms-down lowering motion)', meaning: 'Calm down/slow down' },
        ],
        note: 'Naples has a documented gesture vocabulary of over 200 distinct meanings. Words and gesture work together.' },
    ],
  },
  'Sicilian': {
    dialects: ['Sicilian','Sicily','Palermo','Catania'], color: '#b45309', flag: '🏝️',
    intro: "Sicilian is a Romance language in its own right — older than standard Italian, with heavy Arabic, Norman French, and Greek influences from centuries of foreign rule.",
    features: [
      { title: 'Arabic and Norman vocabulary', icon: '🕌',
        rule: 'Centuries of Arab and Norman rule left hundreds of words in everyday Sicilian that don\'t exist in standard Italian.',
        examples: [
          { standard: 'arancia (standard)', local: 'aranciu', meaning: 'orange (from Arabic "naranj")' },
          { standard: 'zucchero (standard)', local: 'zùccaru', meaning: 'sugar (from Arabic "sukkar")' },
          { standard: 'ragazzo (standard)', local: 'picciotto', meaning: 'boy/young man' },
        ],
        note: 'The Arabic layer in Sicilian vocabulary is one of the most extensive in any European language.' },
      { title: '-u instead of -o endings', icon: '🔤',
        rule: 'Standard Italian masculine words end in -o. Sicilian changes them to -u.',
        examples: [
          { standard: 'bello', local: 'beddu', meaning: 'beautiful' },
          { standard: 'buono', local: 'bonu', meaning: 'good' },
          { standard: 'solo', local: 'sulu', meaning: 'alone/only' },
        ],
        note: '"Beddu" for "beautiful" is immediately recognisable as Sicilian and impossible to mistake for any other Italian variety.' },
    ],
  },
  'American English': {
    dialects: ['English','American','American English'], color: '#7c3aed', flag: '🇺🇸',
    intro: 'Textbook English is clear and enunciated. American English in real conversation is reduced, contracted, and full of sounds that blend together.',
    features: [
      { title: 'Gonna, wanna, gotta — reduced forms', icon: '⚡',
        rule: '"Going to", "want to", "got to" are almost never said in full in casual American speech.',
        examples: [
          { standard: 'going to', local: 'gonna', meaning: "I'm gonna be late" },
          { standard: 'want to', local: 'wanna', meaning: 'Do you wanna eat?' },
          { standard: 'got to / have to', local: 'gotta', meaning: 'I gotta go' },
          { standard: 'kind of', local: 'kinda', meaning: "It's kinda good" },
        ],
        note: "These reductions are not lazy — they're the natural rhythm of American speech." },
      { title: 'Flap T — D in the middle', icon: '🥁',
        rule: 'In American English, a T between two vowels sounds like a soft D.',
        examples: [
          { standard: 'water', local: 'waDer', meaning: 'the T sounds like D' },
          { standard: 'better', local: 'beDer', meaning: 'common in all American speech' },
          { standard: 'butter', local: 'buDer', meaning: 'not buTTer' },
        ],
        note: 'British English keeps the T crisp — Americans tap it into a D. "Bottle of water" = "boDdle of waDer."' },
      { title: 'Filler words — like, you know, I mean', icon: '💬',
        rule: 'American casual speech is full of filler words that buy thinking time.',
        examples: [
          { standard: 'I think...', local: 'I mean, like...', meaning: 'softening a statement' },
          { standard: 'Do you understand?', local: 'You know what I mean?', meaning: 'checking understanding' },
          { standard: 'Approximately', local: 'Like, around...', meaning: '"It was like, 5pm"' },
        ],
        note: '"Like" in American English is not just a comparison word — it\'s a quotative marker, a hedge, and a filler.' },
    ],
  },
  'Haitian Creole': {
    dialects: ['Creole','Haiti','Haitian','Haitian Creole'], color: '#dc2626', flag: '🇭🇹',
    intro: 'Haitian Creole developed from French but evolved into its own complete language with African roots and unique grammar. It\'s phonetically consistent — words are spelled how they sound.',
    features: [
      { title: 'No verb conjugation', icon: '🎯',
        rule: 'Haitian Creole verbs never change form. Tense is shown by markers before the verb.',
        examples: [
          { standard: 'I eat', local: 'Mwen manje', meaning: 'present' },
          { standard: 'I ate', local: 'Mwen te manje', meaning: 'past — add "te"' },
          { standard: 'I will eat', local: 'Mwen pral manje', meaning: 'future — add "pral"' },
          { standard: 'I am eating', local: 'Mwen ap manje', meaning: 'progressive — add "ap"' },
        ],
        note: '"Te" before a verb = past. "Pral" = future. "Ap" = ongoing. The verb never changes.' },
      { title: 'Definite article comes after the noun', icon: '🔄',
        rule: 'In Haitian Creole, "the" comes AFTER the noun — the opposite of French and English.',
        examples: [
          { standard: 'the man', local: 'nonm nan', meaning: 'man + the' },
          { standard: 'the house', local: 'kay la', meaning: 'house + the' },
          { standard: 'the children', local: 'timoun yo', meaning: 'children + the (plural)' },
        ],
        note: '"La", "nan", and "yo" are the postpositive articles. "Yo" marks plural.' },
      { title: 'Key greetings and responses', icon: '👋',
        rule: 'Haitian greetings are call-and-response — knowing the expected reply is as important as the greeting.',
        examples: [
          { standard: 'Sak pase?', local: 'N ap boule', meaning: "What's up? → We're good" },
          { standard: 'Bonjou', local: 'Bonjou tou', meaning: 'Good morning → Good morning too' },
          { standard: 'Mèsi', local: 'Pa de kwa', meaning: "Thank you → You're welcome" },
        ],
        note: '"Sak pase / N ap boule" is the most common exchange. Learn the response as a unit.' },
    ],
  },
};

// ─── Resolver ─────────────────────────────────────────────────────────────────
function resolveEntry(lang, dialect) {
  const search = (dialect + ' ' + lang).toLowerCase();
  for (const [, val] of Object.entries(DIALECT_DECODER)) {
    if (val.dialects.some(d => search.includes(d.toLowerCase()) || d.toLowerCase().includes((dialect || '').toLowerCase()))) {
      return val;
    }
  }
  // Language-level fallback
  if (lang === 'Spanish') {
    if (['Dominican','Puerto Rican','Cuban','Venezuelan'].some(d => dialect.includes(d))) return DIALECT_DECODER['Caribbean Spanish'];
    if (dialect.includes('Mexican') || dialect === 'Mexico') return DIALECT_DECODER['Mexican Spanish'];
    if (dialect.includes('Colombian') || dialect.includes('Colombia')) return DIALECT_DECODER['Colombian Spanish'];
    if (dialect.includes('Spain') || dialect.includes('Castilian') || dialect.includes('Madrid')) return DIALECT_DECODER['Castilian Spanish'];
  }
  if (lang === 'Portuguese') {
    return dialect.toLowerCase().includes('portugal') || dialect.toLowerCase().includes('european')
      ? DIALECT_DECODER['European Portuguese']
      : DIALECT_DECODER['Brazilian Portuguese'];
  }
  if (lang === 'French') {
    return dialect.toLowerCase().includes('southern') || dialect.toLowerCase().includes('provence') || dialect.toLowerCase().includes('marseille')
      ? DIALECT_DECODER['Southern French']
      : DIALECT_DECODER['Parisian French'];
  }
  if (lang === 'Italian') return DIALECT_DECODER['Italian'];
  if (lang === 'English') return DIALECT_DECODER['American English'];
  if (lang === 'Creole' || (dialect || '').toLowerCase().includes('haiti')) return DIALECT_DECODER['Haitian Creole'];
  return null;
}

function getKeyForEntry(entry) {
  return Object.entries(DIALECT_DECODER).find(([, v]) => v === entry)?.[0] || '';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DialectDecoder() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { speak, getVoiceId } = useTTS();

  const languages  = state.languages || [];
  const activeLang = state.activeLang?.lang ? state.activeLang : languages[0];
  const lang       = activeLang?.lang    || '';
  const dialect    = activeLang?.dialect || lang;

  const defaultEntry = resolveEntry(lang, dialect);
  const [selected, setSelected] = useState(defaultEntry);

  const entry = selected;
  const entryKey = entry ? getKeyForEntry(entry) : '';

  async function playExample(text) {
    if (!entry) return;
    const voiceId = getVoiceId(dialect, lang, '');
    if (!voiceId) return;
    const token = await getValidToken();
    const langCode = getLangCode(lang, dialect);
    speak({ text, voiceId, lang: langCode, accessToken: token });
  }

  return (
    <div className="screen active" id="screen-dialect-decoder" style={{ alignItems: 'center', padding: '28px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', marginBottom: 5 }}>
            🗣️ Native Ear
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            Hear how locals actually say it — fast, clipped, with real accent and rhythm.
          </p>
        </div>

        {/* Dialect selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>
            Browse by dialect
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(DIALECT_DECODER).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setSelected(val)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
                  fontFamily: "'DM Sans',sans-serif", cursor: 'pointer', transition: 'all .15s',
                  border: `2px solid ${selected === val ? val.color : 'var(--border)'}`,
                  background: selected === val ? `${val.color}15` : 'var(--card)',
                  color: selected === val ? val.color : 'var(--muted)',
                }}
              >
                {val.flag} {key}
              </button>
            ))}
          </div>
        </div>

        {/* No selection */}
        {!entry && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div>
            <p>Select a dialect above to see how it differs from textbook {lang || 'the language'}.</p>
          </div>
        )}

        {/* Entry */}
        {entry && (
          <>
            {/* Intro card */}
            <div style={{ background: `${entry.color}15`, border: `2px solid ${entry.color}30`, borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: entry.color, marginBottom: 6 }}>
                {entry.flag} {entryKey}
              </div>
              <p style={{ fontSize: '.88rem', lineHeight: 1.65, color: 'var(--ink)' }}>{entry.intro}</p>
            </div>

            {/* Features */}
            {entry.features.map((f, fi) => (
              <div key={fi} className="dialect-feature-card">
                <div className="dialect-feature-header">
                  <span className="dialect-feature-icon">{f.icon}</span>
                  <span className="dialect-feature-title">{f.title}</span>
                </div>
                <p className="dialect-feature-rule">{f.rule}</p>
                <div className="dialect-examples">
                  {f.examples.map((ex, ei) => (
                    <div key={ei} className="dialect-example-row">
                      <div className="dialect-ex-standard">
                        <span className="dialect-ex-label">Standard</span>{ex.standard}
                      </div>
                      <div className="dialect-arrow">→</div>
                      <div className="dialect-ex-local">
                        <span className="dialect-ex-label">Local</span>
                        <strong>{ex.local}</strong>
                      </div>
                      <div className="dialect-ex-meaning">{ex.meaning}</div>
                      <button
                        onClick={() => playExample(ex.local)}
                        style={{ marginTop: 6, background: 'none', border: `1px solid ${entry.color}`, color: entry.color, fontFamily: "'DM Sans',sans-serif", fontSize: '.68rem', padding: '3px 10px', borderRadius: 6, cursor: 'pointer' }}
                      >
                        ▶ Hear it
                      </button>
                    </div>
                  ))}
                </div>
                {f.note && (
                  <div className="dialect-note">💡 {f.note}</div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
