// =============================================
// AI SERVICE — Uses Google Gemini (FREE)
// =============================================

async function generateWithGemini(business) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = buildPrompt(business);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function generateWithGroq(business) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: buildPrompt(business) }],
      temperature: 0.8
    })
  });
  const data = await response.json();
  const text = data.choices[0].message.content;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function buildPrompt(business) {
  const { name, location, keywords = [], categories = [], doctor_name } = business;

  // ✅ FIXED: removed stray comment that broke the syntax
  const categoryList = categories.length > 0
    ? categories.join(', ')
    : 'Dentist, Dental Treatment, Smile Designing, Tooth Removal, Root Canal Treatment, Braces, Aligners, Tooth Fillings';

  return `You are an expert at writing authentic Google reviews for dental clinics.

Generate 40 genuine-sounding Google reviews for a dental clinic called "${name}" located in ${location || 'Srikakulam, Andhra Pradesh'}.

Keywords to naturally include: ${keywords.join(', ') || 'painless treatment, friendly staff, clean clinic, professional'}

Rules:
- Sound like real patients wrote these
- The clinic doctor's name is ${doctor_name || 'Dr. Sandeep'}. Mention this name in 2-3 reviews naturally — not in every review, only where it feels genuine
- Vary the length — some 1-2 lines (casual), some 3-4 lines (detailed)
- Mix tones: relieved, grateful, impressed, casual
- Each review must be completely unique — no repetition across categories
- Naturally mention treatments like cleaning, extraction, braces, implants, root canal etc.
- Do NOT mention specific prices
- Do NOT use fake-sounding superlatives like "best clinic in the world"

Organize into exactly these 8 categories: ${categoryList}
Each category must have exactly 5 reviews.

Return ONLY a valid JSON object (no other text, no markdown fences):
{
  "categories": [
    {
      "categoryName": "Dentist",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    },
    {
      "categoryName": "Dental Treatment",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    },
    {
      "categoryName": "Smile Designing",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    },
    {
      "categoryName": "Tooth Removal",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    },
    {
      "categoryName": "Root Canal Treatment",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    },
    {
      "categoryName": "Braces",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    },
    {
      "categoryName": "Aligners",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    },
    {
      "categoryName": "Tooth Fillings",
      "reviews": ["review 1", "review 2", "review 3", "review 4", "review 5"]
    }
  ]
}`;
}

async function generateReviews(business) {
  const provider = process.env.AI_PROVIDER || 'gemini';
  try {
    if (provider === 'groq') return await generateWithGroq(business);
    return await generateWithGemini(business);
  } catch (err) {
    console.error(`AI generation failed with ${provider}:`, err.message);
    if (provider === 'gemini' && process.env.GROQ_API_KEY) {
      console.log('Falling back to Groq...');
      return await generateWithGroq(business);
    }
    throw err;
  }
}

module.exports = { generateReviews };