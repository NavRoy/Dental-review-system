-- =============================================
-- DENTAL HOSPITAL REVIEW SYSTEM — DATABASE
-- Run this once in your PostgreSQL database
-- =============================================

-- 1. Businesses (just one dental hospital, but designed to support more)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,         -- e.g. "smile-dental-chennai"
  google_review_link TEXT NOT NULL,           -- paste from Google Maps
  plan_status VARCHAR(20) DEFAULT 'active',   -- active / expired
  plan_expires_at TIMESTAMP,
  keywords TEXT[],                            -- ["implants", "Chennai", "painless"]
  business_type VARCHAR(100) DEFAULT 'dental clinic',
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Categories (e.g. "Treatment Quality", "Staff", "Cleanliness")
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL
);

-- 3. Reviews pool
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  review_text TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',       -- PENDING / USED
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Admin users (your hospital's existing admin + new one)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'admin',           -- superadmin / admin
  business_id UUID REFERENCES businesses(id), -- which business they manage
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Usage logs (optional but useful)
CREATE TABLE IF NOT EXISTS review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id),
  business_id UUID REFERENCES businesses(id),
  used_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for speed
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
