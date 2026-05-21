# 🦷 Dental Hospital Review System — Complete Setup Guide

## What this system does
- Staff scan a QR code → see review templates → copy & post on Google
- Reviews are AI-generated based on your clinic's keywords
- Admin dashboard to manage reviews, regenerate with AI, view stats
- Existing hospital admin gets their own login

---

## Folder structure
```
dental-review-system/
├── backend/              ← Node.js API server (port 3000)
│   ├── server.js
│   ├── schema.sql        ← Run once in PostgreSQL
│   ├── .env.example      ← Copy to .env and fill in
│   ├── routes/
│   │   ├── auth.js       ← Login
│   │   ├── reviews.js    ← Employee-facing API
│   │   └── admin.js      ← Dashboard API
│   └── services/
│       ├── db.js
│       └── ai.js         ← Google Gemini (FREE)
├── review-page/          ← What staff see when they scan QR (port 4000)
│   ├── server.js
│   └── public/
│       └── index.html
└── admin-dashboard/      ← Admin login + management (open directly in browser)
    └── index.html
```

---

## STEP 1 — Get a FREE PostgreSQL database

Go to **https://neon.tech** → Sign up free → Create a project called "dental-reviews"
Copy the connection string — looks like:
```
postgresql://user:pass@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## STEP 2 — Get a FREE AI API key (Google Gemini)

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with any Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza...`)
5. Free tier: 1,500 requests/day — more than enough

---

## STEP 3 — Set up the backend

```bash
# In terminal:
cd dental-review-system/backend
npm install

# Copy env file
cp .env.example .env
```

Open `.env` and fill in:
```
DATABASE_URL=postgresql://your-neon-connection-string
GEMINI_API_KEY=AIzaSy...your-key...
JWT_SECRET=any-long-random-string-like-thisABC123XYZ456
SITE_URL=http://localhost:4000
PORT=3000
AI_PROVIDER=gemini
```

---

## STEP 4 — Create the database tables

```bash
# Install psql if needed, or use Neon's web SQL editor
# In Neon dashboard → SQL Editor → paste and run schema.sql contents
```

Or run locally if you have psql:
```bash
psql "your-neon-connection-string" -f schema.sql
```

---

## STEP 5 — Start the backend

```bash
cd backend
npm run dev
# → Running on http://localhost:3000
```

---

## STEP 6 — Create your first admin accounts

**Create yourself as superadmin** (run this once via any API client or curl):
```bash
curl -X POST http://localhost:3000/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"you@yoursite.com","password":"YourPassword123","name":"Super Admin","role":"superadmin"}'
```

**Create the hospital's existing admin:**
```bash
curl -X POST http://localhost:3000/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"hospital@admin.com","password":"HospitalPass123","name":"Hospital Admin","role":"admin"}'
```

> ⚠️ After creating both admins, remove or comment out the /auth/create-admin route in auth.js for security!

---

## STEP 7 — Create your dental clinic + generate AI reviews

1. Open admin-dashboard/index.html in your browser
2. Log in as superadmin
3. Go to Settings → Add New Business
4. Fill in:
   - Business Name: "Your Dental Clinic Name"
   - Google Review Link: (get from Google Maps → Your Business → Share → Copy review link)
   - Location: "Anna Nagar, Chennai" (or your area)
   - Keywords: `painless treatment, experienced dentist, clean clinic, implants, braces, root canal, children-friendly`
5. Click "Create Business + Generate Reviews"
6. Wait ~15 seconds — AI generates 20 reviews
7. Copy the slug (e.g. `your-dental-clinic-chennai-abc123`)

---

## STEP 8 — Link hospital admin to the business

After creating the business, get its ID from the database:
```sql
SELECT id, name, slug FROM businesses;
```

Then update the hospital admin's business_id:
```sql
UPDATE admins SET business_id = 'paste-business-uuid-here' WHERE email = 'hospital@admin.com';
```

Now when the hospital admin logs in, they only see their own clinic's data.

---

## STEP 9 — Start the review page server

```bash
cd review-page
npm init -y
npm install express
node server.js
# → Running on http://localhost:4000
```

Test it: Open http://localhost:4000/r/your-slug in browser — you should see the review templates!

---

## STEP 10 — Get the QR code

1. Open admin dashboard
2. Go to QR Code tab
3. Click "Generate QR Code"
4. Download the QR image
5. Print it and place at reception

---

## Updating reviews (when pool runs low)

1. Admin logs in → Keywords & AI
2. Update/add keywords if needed
3. Click "Generate New Reviews with AI"
4. 20 fresh reviews are added to the pool

Or click "Reset Used Reviews" to reuse existing ones.

---

## Deploying to production (free hosting)

### Backend — Railway.app (free)
1. Push code to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add environment variables (same as .env)
4. Railway gives you a URL like `https://your-app.railway.app`

### Review page — same Railway project or Render.com

### Update API URLs:
- In `review-page/public/index.html`: change `API_BASE` to your Railway backend URL
- In `admin-dashboard/index.html`: change `API` to your Railway backend URL
- In `.env`: change `SITE_URL` to your review page URL

---

## Getting the Google Review Link

1. Go to Google Maps
2. Search your business
3. Click your listing
4. Click "Get more reviews" (or Share → Copy link)
5. The link looks like: `https://g.page/r/XXXXXX/review`
6. Paste this into the admin dashboard when creating the business

---

## Summary — what each person does

| Person | Access | What they do |
|--------|--------|--------------|
| You (superadmin) | Full access | Create business, manage everything |
| Hospital admin | Their clinic only | Update keywords, view stats, get QR |
| Staff | Just the /r/slug URL | Copy and post reviews |
| Patients | Nothing | Just gets a genuine-sounding review posted |
