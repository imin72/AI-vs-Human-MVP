
/**
 * 🏭 COGNITO FACTORY: MASTER SEEDER SCRIPT
 * 
 * Usage: node scripts/seed.js
 * 
 * Logic:
 * 1. Iterates through all defined Categories and Topics.
 * 2. Checks data/questions/*.ts files to see if questions already exist.
 * 3. If questions are missing (target count not met), calls Gemini API.
 * 4. Generates questions for ALL difficulties (EASY, MEDIUM, HARD).
 * 5. Appends the new questions directly to the .ts files.
 */

import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' }); // Also check .env.local

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_API_KEY;

if (!API_KEY || API_KEY.includes("PLACEHOLDER")) {
  console.error("❌ ERROR: Valid API_KEY is missing in .env or .env.local");
  console.error("Please add: API_KEY=AIzaSy...");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = 'gemini-2.5-flash'; 

// --- ⚙️ CONFIGURATION (조절 가능) ---
const QUESTIONS_PER_BATCH = 5;  // 한 번 요청에 생성할 문제 수 (최대 5~10 권장)
const TARGET_TOTAL = 5;         // 난이도별 목표 문제 수 (운영 시 10~20으로 늘리세요)
const TARGET_LANG = "en";       // 마스터 데이터는 영어로 생성 (앱이 실시간 번역 가능)
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];
// -------------------------------------

// Complete Topic Map
const TOPIC_MAP = {
  "HISTORY": ["Ancient Egypt", "Roman Empire", "World War II", "Cold War", "Renaissance", "Industrial Revolution", "French Revolution", "American Civil War", "Feudal Japan", "The Vikings", "Aztec Empire", "Mongol Empire", "The Crusades", "Victorian Era", "Prehistoric Era", "Decolonization"],
  "SCIENCE": ["Quantum Physics", "Genetics", "Organic Chemistry", "Neuroscience", "Botany", "Astronomy", "Geology", "Thermodynamics", "Marine Biology", "Evolution", "Particle Physics", "Immunology", "Paleontology", "Meteorology", "Robotics", "Ecology"],
  "ARTS": ["Impressionism", "Renaissance Art", "Cubism", "Surrealism", "Baroque", "Modernism", "Sculpture", "Graphic Design", "Fashion History", "Photography", "Theater", "Opera", "Abstract Expressionism", "Pottery", "Calligraphy", "Gothic Architecture"],
  "GENERAL": ["1980s Trivia", "1990s Trivia", "Inventions", "World Capitals", "Currencies", "Nobel Prizes", "Phobias", "Brand Logos", "Cryptocurrency", "Viral Trends", "Board Games", "Card Games", "Superheroes", "Classic Toys", "Cocktails", "Car Brands"],
  "GEOGRAPHY": ["Capitals", "Landmarks", "Mountains", "Rivers", "Deserts", "Islands", "Volcanos", "Flags", "Population Stats", "Climate Zones", "Oceans", "US States", "European Countries", "Asian Cities", "African Nations", "Borders"],
  "MOVIES": ["Oscars", "Sci-Fi", "Horror", "Marvel Cinematic Universe", "Star Wars", "Pixar", "80s Movies", "90s Movies", "Famous Directors", "Movie Soundtracks", "Cult Classics", "Anime Movies", "French Cinema", "Silent Era", "Special Effects", "Movie Villains"],
  "MUSIC": ["Rock & Roll", "Pop Music", "Jazz", "Classical", "Hip Hop", "K-Pop", "EDM", "Heavy Metal", "Blues", "Country", "Opera", "Musical Instruments", "90s Hits", "One Hit Wonders", "Music Theory", "Woodstock"],
  "GAMING": ["Nintendo", "PlayStation", "Xbox", "PC Gaming", "RPGs", "FPS", "Arcade Classics", "Retro Gaming", "Esports", "Minecraft", "Pokemon", "Zelda", "Mario", "Indie Games", "Speedrunning", "MMOs"],
  "SPORTS": ["Soccer", "Basketball", "Baseball", "Tennis", "Golf", "Formula 1", "Olympics", "Boxing", "MMA", "Cricket", "Rugby", "Swimming", "Winter Sports", "Skateboarding", "Wrestling", "World Cup"],
  "TECH": ["Artificial Intelligence", "Smartphones", "Internet History", "Social Media", "Coding", "Cybersecurity", "Space Tech", "VR/AR", "Blockchain", "Robots", "Computer Hardware", "Big Data", "Startups", "Hackers", "Gaming Tech", "5G"],
  "MYTHOLOGY": ["Greek Mythology", "Norse Mythology", "Egyptian Mythology", "Roman Mythology", "Japanese Folklore", "Chinese Mythology", "Celtic Mythology", "Aztec Mythology", "Hindu Mythology", "Native American", "Legendary Monsters", "Epic Heroes", "Underworlds", "Creation Myths", "Gods of War", "Tricksters"],
  "LITERATURE": ["Shakespeare", "Classic Novels", "Dystopian Fiction", "Fantasy", "Sci-Fi Books", "Poetry", "Horror", "Mystery", "Comics & Manga", "Nobel Laureates", "Fairy Tales", "Greek Epics", "Russian Literature", "American Literature", "British Literature", "Playwrights"],
  "NATURE": ["Mammals", "Birds", "Insects", "Marine Life", "Dinosaurs", "Rain Forests", "Deserts", "Weather", "Flowers", "Trees", "National Parks", "Survival Skills", "Evolution", "Endangered Species", "Fungi", "Gems & Minerals"],
  "FOOD": ["Italian Cuisine", "French Cuisine", "Mexican Food", "Japanese Food", "Chinese Food", "Indian Food", "Desserts", "Wine", "Coffee", "Cheese", "Spices", "Street Food", "Fast Food", "Baking", "Vegan", "Cocktails"],
  "SPACE": ["Solar System", "Black Holes", "Mars", "Moon Landing", "Constellations", "Stars", "Galaxies", "Astronauts", "Space Race", "Telescopes", "Exoplanets", "Gravity", "Rockets", "SETI", "International Space Station", "Big Bang"],
  "PHILOSOPHY": ["Ethics", "Logic", "Metaphysics", "Existentialism", "Stoicism", "Nihilism", "Political Philosophy", "Eastern Philosophy", "Ancient Greek", "Enlightenment", "Utilitarianism", "Aesthetics", "Epistemology", "Philosophy of Mind", "Famous Quotes", "Paradoxes"]
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const getDifficultyInstruction = (difficulty) => {
  switch (difficulty) {
    case "EASY":
      return `Target: General public. Focus: Definitions, famous facts, 'What/Who'. Avoid obscurity.`;
    case "MEDIUM":
      return `Target: Enthusiasts. Focus: Context, 'How/Why', comparisons. Requires understanding.`;
    case "HARD":
      return `Target: Experts. Focus: Nuance, specific dates, technical details, exceptions. Very challenging.`;
    default: return "";
  }
};

async function generateQuestions(topic, difficulty, count) {
  const diffInstruction = getDifficultyInstruction(difficulty);
  const prompt = `
    Generate ${count} multiple-choice questions about "${topic}".
    DIFFICULTY: ${difficulty}. ${diffInstruction}
    Constraints:
    - STRICTLY OBJECTIVE FACTS ONLY.
    - Language: English
    - JSON Format: Array of objects { id, question, options (4 strings), correctAnswer, context }.
    - ID: Use a random integer.
  `;

  try {
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });
    const text = response.text || "[]";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error(`      ⚠️ API Error: ${e.message}`);
    return [];
  }
}

async function runSeeder() {
  console.log(`\n🏭 COGNITO PROTOCOL: DATA FACTORY INITIALIZED`);
  console.log(`🎯 Target: ${TARGET_TOTAL} questions per [Topic/Difficulty]`);
  console.log(`🔑 API Key detected.`);

  for (const [category, subtopics] of Object.entries(TOPIC_MAP)) {
    console.log(`\n📂 CATEGORY: ${category}`);
    
    // 1. Prepare File
    const filename = `${category.toLowerCase()}.ts`;
    const filePath = path.resolve(__dirname, '../data/questions', filename);
    const dirPath = path.dirname(filePath);

    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `import { QuizQuestion } from '../../types';\n\nexport const ${category}_DB: Record<string, QuizQuestion[]> = {\n};`);
      console.log(`   + Created file: ${filename}`);
    }

    // 2. Iterate Topics
    for (const topic of subtopics) {
      process.stdout.write(`   👉 ${topic.padEnd(25)} `);

      for (const difficulty of DIFFICULTIES) {
        const key = `${topic}_${difficulty}_${TARGET_LANG}`;
        let fileContent = fs.readFileSync(filePath, 'utf-8');

        // Check current count in file using Regex
        const regex = new RegExp(`"${key}":\\s*\\[([\\s\\S]*?)\\]`, 'm');
        const match = fileContent.match(regex);
        let currentCount = 0;
        
        if (match) {
          // Count occurences of "id" to guess number of questions
          currentCount = (match[1].match(/"id":/g) || []).length;
        }

        if (currentCount >= TARGET_TOTAL) {
          process.stdout.write(`[${difficulty[0]}:✔] `); // Skip
          continue;
        }

        // Generate missing
        const needed = TARGET_TOTAL - currentCount;
        const batchSize = Math.min(needed, QUESTIONS_PER_BATCH);
        
        // Rate Limiting Pause (Free tier friendly)
        await sleep(2000); 

        const newQuestions = await generateQuestions(topic, difficulty, batchSize);
        
        if (newQuestions.length > 0) {
           // Fix IDs to be unique
           const cleanQuestions = newQuestions.map((q, idx) => ({
             ...q,
             id: Date.now() + Math.floor(Math.random() * 1000000) + idx
           }));

           // Append Logic
           if (match) {
              // Insert into existing array
              const closingBracket = match.index + match[0].lastIndexOf(']');
              const jsonStr = JSON.stringify(cleanQuestions, null, 2).slice(1, -1); // remove outer []
              const insert = currentCount > 0 ? `,${jsonStr}` : jsonStr;
              fileContent = fileContent.slice(0, closingBracket) + insert + fileContent.slice(closingBracket);
           } else {
              // Create new key
              const newEntry = `\n  "${key}": ${JSON.stringify(cleanQuestions, null, 2)},`;
              const lastBrace = fileContent.lastIndexOf('};');
              fileContent = fileContent.slice(0, lastBrace) + newEntry + "\n};";
           }
           
           fs.writeFileSync(filePath, fileContent);
           process.stdout.write(`[${difficulty[0]}:+${cleanQuestions.length}] `);
        } else {
           process.stdout.write(`[${difficulty[0]}:x] `);
        }
      }
      console.log(""); // New line
    }
  }
  console.log("\n✨ FACTORY SHUTDOWN. ALL DATA SECURED.");
}

runSeeder();
