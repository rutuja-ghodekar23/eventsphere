const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const auth    = require('../middleware/auth');
require('dotenv').config();

// GET /api/payment/config — safely expose Razorpay key ID to frontend
router.get('/config', (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const isDemo = !keyId || keyId.includes('your_key') || keyId === 'rzp_test_demo';
  res.json({
    key_id: isDemo ? '' : keyId,
    mode: isDemo ? 'demo' : 'live',
    test_mode: keyId.startsWith('rzp_test_')
  });
});

// POST /api/payment/order — create Razorpay order
// NOTE: Razorpay SDK is optional. If not installed, returns a test order for demo.
router.post('/order', auth, async (req, res) => {
  const { amount, event_id, event_title } = req.body;
  if (!amount || !event_id) return res.status(400).json({ message: 'Amount and event_id required.' });

  // Try real Razorpay if credentials exist
  if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('your_key_id')) {
    try {
      const Razorpay = require('razorpay');
      const rzp = new Razorpay({
        key_id:     process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      const order = await rzp.orders.create({
        amount: amount * 100, // paise
        currency: 'INR',
        receipt: `evs_${event_id}_${req.user.user_id}_${Date.now()}`
      });
      return res.json({ order_id: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID });
    } catch (e) {
      console.error('Razorpay error:', e.message);
    }
  }

  // Demo/test mode — return a fake order (works without Razorpay account)
  const demoOrderId = 'order_demo_' + Date.now();
  res.json({
    order_id: demoOrderId,
    amount: amount * 100,
    currency: 'INR',
    key: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
    demo_mode: true
  });
});

// POST /api/payment/verify — verify Razorpay payment signature
router.post('/verify', auth, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Demo mode — auto-approve
  if (razorpay_order_id && razorpay_order_id.startsWith('order_demo_')) {
    return res.json({ verified: true, demo: true });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Payment details incomplete.' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (expectedSignature === razorpay_signature) {
    res.json({ verified: true });
  } else {
    res.status(400).json({ message: 'Payment verification failed.' });
  }
});

module.exports = router;
