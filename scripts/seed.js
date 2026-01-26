
/**
 * PRODUCTION SEEDER SCRIPT
 * 
 * Usage: node scripts/seed.js
 * 
 * Purpose:
 * Pre-generates high-quality questions for ALL defined topics using Gemini API.
 * This populates the `data/questions/*.ts` files, allowing the app to run 
 * mostly offline/static, drastically reducing runtime API costs and latency.
 */

import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.API_KEY || process.env.VITE_API_KEY;

if (!API_KEY) {
  console.error("❌ API_KEY is missing in .env file");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = 'gemini-2.5-flash'; 

// Configuration
const QUESTIONS_PER_BATCH = 5; // Generate 5 at a time
const TARGET_TOTAL = 10; // Target total questions per topic (Increase this to 20-50 for prod)
const TARGET_DIFFICULTY = "HARD";
const TARGET_LANG = "en"; // Master data is English

// Complete Topic Map (Mirrors translations.ts)
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

// Helper: Sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function generateQuestions(topic, count, existingQuestions = []) {
  const existingContexts = existingQuestions.map(q => q.question.substring(0, 20));
  
  const prompt = `
    Generate ${count} challenging, high-quality multiple-choice questions about "${topic}".
    
    Constraints:
    - **STRICT OBJECTIVITY**: Questions must be based on absolute facts, physical laws, historical dates, or verifiable data.
    - **NO DUPLICATES**: Avoid asking about: ${JSON.stringify(existingContexts)}.
    - Language: English
    - Difficulty: ${TARGET_DIFFICULTY}
    - Format: JSON Array of objects with keys: id (number), question (string), options (string array), correctAnswer (string), context (string).
    - Context: A short, interesting fact explaining the answer (max 1 sentence).
    - ID: Use random unique integers.
  `;

  const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
          responseMimeType: "application/json"
      }
  });

  const rawText = response.text || "[]";
  const jsonText = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(jsonText);
}

async function runSeeder() {
  console.log("🏭 Starting Cognito Factory Seeder...");
  console.log(`🎯 Target: ${TARGET_TOTAL} questions per topic`);

  for (const [category, subtopics] of Object.entries(TOPIC_MAP)) {
    console.log(`\n📂 Category: ${category}`);
    
    const filename = `${category.toLowerCase()}.ts`;
    const filePath = path.resolve(__dirname, '../data/questions', filename);

    // 1. Ensure File Exists
    if (!fs.existsSync(filePath)) {
      console.log(`   + Creating ${filename}`);
      fs.writeFileSync(filePath, `import { QuizQuestion } from '../../types';\n\nexport const ${category}_DB: Record<string, QuizQuestion[]> = {\n};`);
    }

    // 2. Read File Content
    let fileContent = fs.readFileSync(filePath, 'utf-8');

    // 3. Process Subtopics
    for (const topic of subtopics) {
      const key = `${topic}_${TARGET_DIFFICULTY}_${TARGET_LANG}`;
      
      // Extract existing data count via Regex (rough count)
      const regex = new RegExp(`"${key}":\\s*\\[([\\s\\S]*?)\\]`, 'm');
      const match = fileContent.match(regex);
      
      let currentCount = 0;
      let existingData = [];
      
      if (match) {
        try {
           // Hacky parsing of the array content inside the TS file
           // This assumes standard JSON-like formatting inside the TS file
           const arrayContent = "[" + match[1] + "]";
           // We can't easily parse TS object literals in JS, so we rely on heuristic count
           // counting "id:" occurrences
           currentCount = (match[1].match(/id:/g) || []).length;
        } catch (e) { }
      }

      if (currentCount >= TARGET_TOTAL) {
        process.stdout.write('.'); // Skip indicator
        continue;
      }

      const needed = TARGET_TOTAL - currentCount;
      const batchSize = Math.min(needed, QUESTIONS_PER_BATCH);
      
      console.log(`\n   ⚡ ${topic}: Found ${currentCount}/${TARGET_TOTAL}. Generating ${batchSize}...`);

      try {
        const newQuestions = await generateQuestions(topic, batchSize, existingData);
        
        if (!Array.isArray(newQuestions) || newQuestions.length === 0) continue;

        // Clean IDs to ensure uniqueness based on timestamp
        const finalQuestions = newQuestions.map((q, idx) => ({
           ...q,
           id: Date.now() + Math.floor(Math.random() * 10000) + idx
        }));

        // INSERTION LOGIC
        if (match) {
            // Append to existing array
            const closingBracketIndex = match.index + match[0].lastIndexOf(']');
            // Remove the closing bracket, add comma, add new data, add closing bracket
            const arrayContent = JSON.stringify(finalQuestions, null, 2).slice(1, -1); // remove [ and ]
            
            const insertStr = `,${arrayContent}`;
            fileContent = fileContent.slice(0, closingBracketIndex) + insertStr + fileContent.slice(closingBracketIndex);
        } else {
            // Create new entry
            const newEntry = `\n  "${key}": ${JSON.stringify(finalQuestions, null, 2)},`;
            const lastBrace = fileContent.lastIndexOf('};');
            fileContent = fileContent.slice(0, lastBrace) + newEntry + "\n};";
        }

        // Save immediately
        fs.writeFileSync(filePath, fileContent);
        console.log(`      ✅ Saved ${finalQuestions.length} questions.`);
        
        // Rate Limit Pause
        await sleep(2000);

      } catch (e) {
        console.error(`      ❌ Error: ${e.message}`);
        await sleep(5000); // Longer pause on error
      }
    }
  }
  console.log("\n\n✨ All topics processed.");
}

runSeeder();
