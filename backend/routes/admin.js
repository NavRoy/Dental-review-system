const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { generateReviews } = require('../services/ai');
const QRCode = require('qrcode');
const auth = require('../middleware/auth');

// ─── ALL ROUTES BELOW REQUIRE ADMIN LOGIN ───────────────────────────────────

// GET /admin/dashboard — stats overview
router.get('/dashboard', auth, async (req, res) => {
  try {
    const businessId = req.admin.business_id;

    // If admin is tied to one business
    const whereClause = businessId ? 'WHERE business_id = $1' : '';
    const params = businessId ? [businessId] : [];

    const pendingCount = await db.query(
      `SELECT COUNT(*) FROM reviews WHERE status = 'PENDING' ${whereClause}`,
      params
    );
    const usedCount = await db.query(
      `SELECT COUNT(*) FROM reviews WHERE status = 'USED' ${whereClause}`,
      params
    );
    const todayCount = await db.query(
      `SELECT COUNT(*) FROM review_logs WHERE used_at > NOW() - INTERVAL '24 hours' ${whereClause}`,
      params
    );

    // Get the business info
    let business = null;
    if (businessId) {
      const bizResult = await db.query('SELECT * FROM businesses WHERE id = $1', [businessId]);
      business = bizResult.rows[0] || null;
    }

    res.json({
      success: true,
      data: {
        pending: parseInt(pendingCount.rows[0].count),
        used: parseInt(usedCount.rows[0].count),
        today: parseInt(todayCount.rows[0].count),
        business
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /admin/businesses — list all businesses (superadmin sees all)
router.get('/businesses', auth, async (req, res) => {
  try {
    let result;
    if (req.admin.role === 'superadmin') {
      result = await db.query('SELECT * FROM businesses ORDER BY created_at DESC');
    } else {
      result = await db.query('SELECT * FROM businesses WHERE id = $1', [req.admin.business_id]);
    }
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /admin/business — create business + generate AI reviews
router.post('/business', auth, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only superadmin can create businesses' });
    }

    const {
      name,
      location,
      keywords = [],
      categories = [],
      google_review_link,
      plan_expires_at,
      custom_slug       // optional — if you want a specific slug
    } = req.body;

    if (!name || !google_review_link) {
      return res.status(400).json({ success: false, message: 'name and google_review_link are required' });
    }

    // Create slug
    const slug = custom_slug
      ? custom_slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).slice(2, 8);

    // Save business
    const bizResult = await db.query(
      `INSERT INTO businesses (name, slug, google_review_link, keywords, location, plan_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, slug, google_review_link, keywords, location, plan_expires_at || null]
    );
    const business = bizResult.rows[0];

    // Generate AI reviews
    console.log('Calling AI to generate reviews...');
   const aiData = await generateReviews({
  name: business.name,
  location: business.location || '',
  keywords: business.keywords || [],
  categories: categories.map(c => c.name),
  doctor_name: business.doctor_name || ''
});

    // Save categories and reviews to DB
    for (const cat of aiData.categories) {
      const catResult = await db.query(
        'INSERT INTO categories (business_id, name) VALUES ($1, $2) RETURNING id',
        [business.id, cat.categoryName]
      );
      const categoryId = catResult.rows[0].id;

      for (const reviewText of cat.reviews) {
        await db.query(
          'INSERT INTO reviews (business_id, category_id, review_text) VALUES ($1, $2, $3)',
          [business.id, categoryId, reviewText]
        );
      }
    }

    res.json({
      success: true,
      message: 'Business created and reviews generated!',
      slug,
      reviewUrl: `${process.env.SITE_URL}/r/${slug}`,
      business
    });

  } catch (err) {
    console.error('Create business error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /admin/business/:id/keywords — update keywords → regenerate all PENDING reviews
router.put('/business/:id/keywords', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { keywords, location, categories } = req.body;

    // Get business
    const bizResult = await db.query('SELECT * FROM businesses WHERE id = $1', [id]);
    if (!bizResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    const business = bizResult.rows[0];

    // Update keywords in DB
    await db.query('UPDATE businesses SET keywords = $1 WHERE id = $2', [keywords, id]);

    // Delete only PENDING reviews (keep USED ones as history)
    await db.query("DELETE FROM reviews WHERE business_id = $1 AND status = 'PENDING'", [id]);

    // Regenerate via AI
    console.log('Regenerating reviews with new keywords...');
    const aiData = await generateReviews({
      name: business.name,
      location: location || business.location,
      keywords,
      categories
    });

    // Save new reviews
    for (const cat of aiData.categories) {
      // Check if category already exists
      let catResult = await db.query(
        'SELECT id FROM categories WHERE business_id = $1 AND name = $2',
        [id, cat.categoryName]
      );

      let categoryId;
      if (catResult.rows.length) {
        categoryId = catResult.rows[0].id;
      } else {
        const newCat = await db.query(
          'INSERT INTO categories (business_id, name) VALUES ($1, $2) RETURNING id',
          [id, cat.categoryName]
        );
        categoryId = newCat.rows[0].id;
      }

      for (const reviewText of cat.reviews) {
        await db.query(
          'INSERT INTO reviews (business_id, category_id, review_text) VALUES ($1, $2, $3)',
          [id, categoryId, reviewText]
        );
      }
    }

    res.json({ success: true, message: 'Keywords updated and reviews regenerated!' });

  } catch (err) {
    console.error('Keyword update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /admin/business/:id/add-reviews — manually add more reviews without AI
router.post('/business/:id/add-reviews', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName, reviews } = req.body; // reviews = array of strings

    // Get or create category
    let catResult = await db.query(
      'SELECT id FROM categories WHERE business_id = $1 AND name = $2',
      [id, categoryName]
    );
    let categoryId;
    if (catResult.rows.length) {
      categoryId = catResult.rows[0].id;
    } else {
      const newCat = await db.query(
        'INSERT INTO categories (business_id, name) VALUES ($1, $2) RETURNING id',
        [id, categoryName]
      );
      categoryId = newCat.rows[0].id;
    }

    for (const text of reviews) {
      await db.query(
        'INSERT INTO reviews (business_id, category_id, review_text) VALUES ($1, $2, $3)',
        [id, categoryId, text]
      );
    }

    res.json({ success: true, message: `${reviews.length} reviews added` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /admin/business/:id/reviews — see all reviews with status
router.get('/business/:id/reviews', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query; // ?status=PENDING or ?status=USED

    let query = `
      SELECT r.*, c.name as category_name
      FROM reviews r
      JOIN categories c ON c.id = r.category_id
      WHERE r.business_id = $1
    `;
    const params = [id];

    if (status) {
      query += ` AND r.status = $2`;
      params.push(status.toUpperCase());
    }

    query += ' ORDER BY c.name, r.created_at DESC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /admin/business/:id/reset-used — reset all USED reviews back to PENDING
router.post('/business/:id/reset-used', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE reviews SET status = 'PENDING', used_at = NULL
       WHERE business_id = $1 AND status = 'USED'
       RETURNING id`,
      [id]
    );
    res.json({ success: true, message: `${result.rowCount} reviews reset to PENDING` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /admin/business/:id/qr — generate QR code for the review page
router.get('/business/:id/qr', auth, async (req, res) => {
  try {
    const bizResult = await db.query('SELECT * FROM businesses WHERE id = $1', [req.params.id]);
    if (!bizResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const business = bizResult.rows[0];
    const url = `${process.env.SITE_URL}/r/${business.slug}`;

    // Generate QR as base64 PNG
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#1a73e8', light: '#ffffff' }
    });

    res.json({
      success: true,
      qr: qrDataUrl,        // base64 image — display directly in <img src="...">
      url,
      slug: business.slug
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /admin/stats/:id — usage stats for a business
router.get('/stats/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const pending = await db.query(
      "SELECT COUNT(*) FROM reviews WHERE business_id = $1 AND status = 'PENDING'", [id]
    );
    const used = await db.query(
      "SELECT COUNT(*) FROM reviews WHERE business_id = $1 AND status = 'USED'", [id]
    );
    const today = await db.query(
      "SELECT COUNT(*) FROM review_logs WHERE business_id = $1 AND used_at > NOW() - INTERVAL '24 hours'", [id]
    );
    const thisWeek = await db.query(
      "SELECT COUNT(*) FROM review_logs WHERE business_id = $1 AND used_at > NOW() - INTERVAL '7 days'", [id]
    );

    res.json({
      success: true,
      data: {
        pending: parseInt(pending.rows[0].count),
        used: parseInt(used.rows[0].count),
        today: parseInt(today.rows[0].count),
        thisWeek: parseInt(thisWeek.rows[0].count)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
