const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

router.get('/health', telemetryController.getHealth);
router.get('/telemetry/latest', telemetryController.getLatest);
router.get('/telemetry/history', telemetryController.getHistory);
router.post('/control', telemetryController.sendControl);

module.exports = router;
