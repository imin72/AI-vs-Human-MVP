
/**
 * PRODUCTION SEEDER SCRIPT
 * 
 * Usage: node scripts/seed.js
 * 
 * Purpose:
 * Pre-generates high-quality questions for ALL defined topics and ALL difficulties.
 * Implements "Cognitive Depth" prompting to ensure objective difficulty levels.
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
const QUESTIONS_PER_BATCH = 3; // Reduced batch size to accommodate multi-difficulty loop
const TARGET_TOTAL_PER_DIFF = 5; // Target questions per difficulty level
const TARGET_LANG = "en"; // Master data is English
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

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

// Helper: Sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: Difficulty Prompts
const getDifficultyInstruction = (difficulty) => {
  switch (difficulty) {
    case "EASY":
      return `
        Target Audience: General Public / Beginners.
        Focus: Basic definitions, famous figures, key events, and widely known facts.
        Style: Straightforward "Who/What/Where" questions.
        Avoid: Obscure dates, complex analysis, or trick questions.
      `;
    case "MEDIUM":
      return `
        Target Audience: Enthusiasts / Students.
        Focus: Cause and effect, context, comparisons, and "Why/How".
        Style: Requires understanding the relationship between concepts, not just memorization.
        Avoid: Surface-level trivia (too easy) or academic minutiae (too hard).
      `;
    case "HARD":
      return `
        Target Audience: Experts / Obsessives.
        Focus: Nuance, exceptions to rules, misconceptions, specific technical details, or complex multi-step reasoning.
        Style: "Which of the following is NOT...", chronological ordering, or specific data points.
        Goal: To challenge someone who thinks they know everything about the topic.
      `;
    default:
      return "";
  }
};

async function generateQuestions(topic, difficulty, count, existingQuestions = []) {
  const existingContexts = existingQuestions.map(q => q.question.substring(0, 20));
  const diffInstruction = getDifficultyInstruction(difficulty);
  
  const prompt = `
    Generate ${count} multiple-choice questions about "${topic}".
    
    DIFFICULTY LEVEL: ${difficulty}
    ${diffInstruction}
    
    Constraints:
    - **STRICT OBJECTIVITY**: Questions must be based on absolute facts.
    - **NO DUPLICATES**: Avoid asking about: ${JSON.stringify(existingContexts)}.
    - Language: English
    - Format: JSON Array of objects with keys: id (number), question (string), options (string array), correctAnswer (string), context (string).
    - Context: A short, interesting fact explaining the answer.
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
  console.log("🏭 Starting Cognito Factory Seeder (Multi-Difficulty Mode)...");
  
  for (const [category, subtopics] of Object.entries(TOPIC_MAP)) {
    console.log(`\n📂 Category: ${category}`);
    
    const filename = `${category.toLowerCase()}.ts`;
    const filePath = path.resolve(__dirname, '../data/questions', filename);

    // 1. Ensure File Exists
    if (!fs.existsSync(filePath)) {
      console.log(`   + Creating ${filename}`);
      fs.writeFileSync(filePath, `import { QuizQuestion } from '../../types';\n\nexport const ${category}_DB: Record<string, QuizQuestion[]> = {\n};`);
    }

    let fileContent = fs.readFileSync(filePath, 'utf-8');

    for (const topic of subtopics) {
      console.log(`   👉 Topic: ${topic}`);

      // Loop through ALL difficulties for each topic
      for (const difficulty of DIFFICULTIES) {
        const key = `${topic}_${difficulty}_${TARGET_LANG}`;
        
        // Check existing count for this specific difficulty key
        const regex = new RegExp(`"${key}":\\s*\\[([\\s\\S]*?)\\]`, 'm');
        const match = fileContent.match(regex);
        
        let currentCount = 0;
        let existingData = [];
        
        if (match) {
          try {
             currentCount = (match[1].match(/id:/g) || []).length;
          } catch (e) { }
        }

        if (currentCount >= TARGET_TOTAL_PER_DIFF) {
          process.stdout.write(`      [${difficulty}: Full]`);
          continue;
        }

        const needed = TARGET_TOTAL_PER_DIFF - currentCount;
        const batchSize = Math.min(needed, QUESTIONS_PER_BATCH);
        
        process.stdout.write(`      [${difficulty}: Gen ${batchSize}...]`);

        try {
          const newQuestions = await generateQuestions(topic, difficulty, batchSize, existingData);
          
          if (!Array.isArray(newQuestions) || newQuestions.length === 0) continue;

          // Unique IDs
          const finalQuestions = newQuestions.map((q, idx) => ({
             ...q,
             id: Date.now() + Math.floor(Math.random() * 100000) + idx
          }));

          // FILE INSERTION
          // We need to re-read file content inside the loop in case previous iterations modified it
          fileContent = fs.readFileSync(filePath, 'utf-8');
          const freshMatch = fileContent.match(regex);

          if (freshMatch) {
              // Append to existing array
              const closingBracketIndex = freshMatch.index + freshMatch[0].lastIndexOf(']');
              const arrayContent = JSON.stringify(finalQuestions, null, 2).slice(1, -1); 
              const insertStr = `,${arrayContent}`;
              fileContent = fileContent.slice(0, closingBracketIndex) + insertStr + fileContent.slice(closingBracketIndex);
          } else {
              // Create new entry
              const newEntry = `\n  "${key}": ${JSON.stringify(finalQuestions, null, 2)},`;
              const lastBrace = fileContent.lastIndexOf('};');
              fileContent = fileContent.slice(0, lastBrace) + newEntry + "\n};";
          }

          fs.writeFileSync(filePath, fileContent);
          process.stdout.write(` ✅`);
          
          await sleep(1500); // Rate limit

        } catch (e) {
          console.error(`\n      ❌ Error: ${e.message}`);
          await sleep(5000);
        }
      }
      console.log(""); // New line after topic
    }
  }
  console.log("\n\n✨ All topics processed.");
}

runSeeder();
