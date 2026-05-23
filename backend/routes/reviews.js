const express = require('express');
const router  = express.Router();
const db      = require('../services/db');

// ── CONFIG ────────────────────────────────────────────────────────────────
const MAX_PER_CAT       = 10;   // always serve 10 per category
const CLAIM_EXPIRY_SEC  = 30;   // unclaimed review released after 30s
const LOW_WATER_MARK    = 25;   // start regen when pending drops below this
const regenInProgress   = new Set(); // prevent double-regen per business

// ── GET /review/:slug ─────────────────────────────────────────────────────
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // 1. Find business
    const bizResult = await db.query(
      'SELECT * FROM businesses WHERE slug = $1',
      [slug]
    );


    if (!bizResult.rows.length) {
      return res.json({ success: false, message: 'Business not found' });
    }
    const business = bizResult.rows[0];

   

    // 2. Plan check
    if (
      business.plan_status === 'expired' ||
      (business.plan_expires_at && new Date() > new Date(business.plan_expires_at))
    ) {
      return res.json({
        success: false,
        message: 'Plan expired',
        data: { reviewLink: business.google_review_link }
      });
    }

    // 3. Release stale CLAIMED reviews (device closed tab / timed out)
    await db.query(
      `UPDATE reviews
       SET status = 'PENDING', claimed_at = NULL, claimed_device = NULL
       WHERE business_id = $1
         AND status = 'CLAIMED'
         AND claimed_at IS NOT NULL
         AND claimed_at < NOW() - INTERVAL '${CLAIM_EXPIRY_SEC} seconds'`,
      [business.id]
    );

    // 4. Get categories
    const catResult = await db.query(
      'SELECT * FROM categories WHERE business_id = $1 ORDER BY name',
      [business.id]
    );

    // 5. Get up to 10 PENDING reviews per category
    const categoriesData = await Promise.all(
      catResult.rows.map(async (cat) => {
        const reviewResult = await db.query(
          `SELECT r.id, r.review_text AS review
           FROM reviews r
           WHERE r.category_id = $1
             AND COALESCE(r.status, 'PENDING') = 'PENDING'
           ORDER BY r.created_at ASC
           LIMIT $2`,
          [cat.id, MAX_PER_CAT]
        );
        return {
          categoryName: cat.name,
          reviews: reviewResult.rows.map(r => ({
            ...r,
           customer: { 
  reviewLink: business.google_review_link,
  reviewLinkMobile: business.google_review_link_mobile || business.google_review_link
}
          }))
        };
      })
    );

    const nonEmpty = categoriesData.filter(c => c.reviews.length > 0);

    if (!nonEmpty.length) {
      return res.json({
        success: false,
        message: 'No reviews available',
        data: { reviewLink: business.google_review_link }
      });
    }

    // 6. Background auto-regen check (non-blocking — fires AFTER response)
    //    Safe to enable: if AI fails, existing reviews are untouched
    //    Uncomment when you're ready:
    setImmediate(() => checkAndRegen(business, catResult.rows));

    res.json({ success: true, data: nonEmpty });

  } catch (err) {
    console.error('GET /review/:slug error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /review/:id/claim ────────────────────────────────────────────────
// Called the instant a device taps "Copy & Post"
// Atomically locks this review so no other device can get it
router.post('/:id/claim', async (req, res) => {
  try {
    const { deviceId } = req.body;

    const result = await db.query(
      `UPDATE reviews
       SET status = 'CLAIMED',
           claimed_at = NOW(),
           claimed_device = $1
       WHERE id = $2
         AND COALESCE(status, 'PENDING') = 'PENDING'
       RETURNING id`,
      [deviceId || 'unknown', req.params.id]
    );

    if (!result.rowCount) {
      // Already claimed or used by another device
      return res.json({ success: false, message: 'Already taken' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /review/:id/claim error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});




// ── PUT /review/:id ───────────────────────────────────────────────────────
// Mark as USED after Google opened
router.put('/:id',async(req,res)=>{

try{

await db.query(

`

UPDATE reviews

SET
status='USED',
used_at=NOW()

WHERE
id=$1

`,

[
req.params.id
]

);

res.json({

success:true

});

}

catch(err){

console.log(err);

res.status(500).json({

success:false

});

}

});

// ── AUTO-REGEN ────────────────────────────────────────────────────────────
// Fires silently after every GET response
// Only triggers AI when pending count drops below LOW_WATER_MARK
// If AI fails → logs error, existing reviews untouched, staff unaffected
async function checkAndRegen(business, categories) {
  if (regenInProgress.has(business.id)) return;

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM reviews
       WHERE business_id = $1
         AND COALESCE(status, 'PENDING') = 'PENDING'`,
      [business.id]
    );
    const pending = parseInt(countResult.rows[0].count);

    if (pending >= LOW_WATER_MARK) return; // enough stock, skip

    console.log(`⚡ Low stock (${pending} pending) for "${business.name}" — regenerating...`);
    regenInProgress.add(business.id);

    const { generateReviews } = require('../services/ai');
const aiData =
await generateReviews({

name:
business.name,

location:
business.location || '',

keywords:
business.keywords || [],

categories:
categories.map(
c=>c.name
)

});

    let added = 0;
    for (const cat of aiData.categories) {
      const matched = categories.find(
        c => c.name.toLowerCase().trim() === cat.categoryName.toLowerCase().trim()
      );
      if (!matched) continue;

      for (const text of cat.reviews) {
        await db.query(
          `INSERT INTO reviews (business_id, category_id, review_text, status)
           VALUES ($1, $2, $3, 'PENDING')`,
          [business.id, matched.id, text]
        );
        added++;
      }
    }

    console.log(`✅ Auto-regen done — added ${added} new reviews for "${business.name}"`);
  } catch (err) {
    console.error('⚠️  Auto-regen failed (staff unaffected):', err.message);
  } finally {
    regenInProgress.delete(business.id);
  }
}

module.exports = router;
