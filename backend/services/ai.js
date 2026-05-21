// =============================================
// AI SERVICE — Uses Google Gemini (FREE)
// Fallback: Groq (also FREE)
// =============================================

// ---- GEMINI (Google AI Studio — FREE tier) ----
async function generateWithGemini(business) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Free tier model

  const prompt = buildPrompt(business);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ---- GROQ (FREE, fast, uses Llama) ----
async function generateWithGroq(business) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile', // Free on Groq
      messages: [{ role: 'user', content: buildPrompt(business) }],
      temperature: 0.8
    })
  });
  const data = await response.json();
  const text = data.choices[0].message.content;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ---- SHARED PROMPT ----
function buildPrompt(business) {
  const { name, location, keywords = [], categories = [] } = business;

  const categoryList = categories.length > 0
    ? categories.join(', ')
    : 'Treatment Quality, Doctor & Staff, Cleanliness & Comfort, Overall Experience';

  return `You are an expert at writing authentic Google reviews for dental clinics.

Generate 20 genuine-sounding Google reviews for a dental clinic called "${name}" located in ${location || 'Chennai, India'}.

Keywords to naturally include: ${keywords.join(', ') || 'painless treatment, friendly staff, clean clinic, professional'}

Rules:
- Sound like real patients wrote these
- Vary the length — some 1-2 lines (casual), some 3-4 lines (detailed)  
- Mix tones: relieved, grateful, impressed, casual
- Each review must be completely unique
- Naturally mention treatments like cleaning, extraction, braces, implants, root canal, etc.
- Do NOT mention specific prices
- Do NOT use fake-sounding superlatives like "best clinic in the world"

Organize into exactly these 4 categories: ${categoryList}

Return ONLY a valid JSON object like this (no other text, no markdown):
{
  "categories": [
    {
      "categoryName": "Treatment Quality",
      "reviews": [
        "review text here",
        "review text here",
        "review text here",
        "review text here",
        "review text here"
      ]
    },
    {
      "categoryName": "Doctor & Staff",
      "reviews": [...]
    },
    {
      "categoryName": "Cleanliness & Comfort",
      "reviews": [...]
    },
    {
      "categoryName": "Overall Experience",
      "reviews": [...]
    }
  ]
}`;
}

// ---- MAIN EXPORT ----
async function generateReviews(business) {
  const provider = process.env.AI_PROVIDER || 'gemini';

  try {
    if (provider === 'groq') {
      return await generateWithGroq(business);
    }
    return await generateWithGemini(business);
  } catch (err) {
    console.error(`AI generation failed with ${provider}:`, err.message);
    // Try the other provider as fallback
    if (provider === 'gemini' && process.env.GROQ_API_KEY) {
      console.log('Falling back to Groq...');
      return await generateWithGroq(business);
    }
    throw err;
  }
}

module.exports = { generateReviews };
