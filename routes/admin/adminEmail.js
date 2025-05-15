// routes/admin/adminEmail.js
const express = require('express');
const router = express.Router();
const { sendAdminEmail } = require('../../controllers/emailController');

router.post('/:userId', sendAdminEmail);

module.exports = router;



