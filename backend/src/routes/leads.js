const express = require('express');
const router = express.Router();
const { authenticate, requireManagerOrAbove } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { body } = require('express-validator');
const leadController = require('../controllers/leadController');

router.use(authenticate);

router.post('/', leadController.createLead);
router.get('/', leadController.getLeads);
router.get('/stages', leadController.getStages);
router.put('/stages', requireManagerOrAbove, leadController.updateStages);
router.get('/tags', leadController.getTags);
router.post('/tags', leadController.createTag);
router.get('/groups', leadController.getGroups);
router.post('/groups', leadController.createGroup);
router.get('/custom-fields', leadController.getCustomFields);
router.post('/custom-fields', requireManagerOrAbove, leadController.createCustomField);
router.get('/export-history', leadController.getExportHistory);
router.post('/import', leadController.importLeads);
router.post('/import-phonebook', leadController.importPhonebook);
router.post('/export', leadController.exportLeads);
router.post('/bulk', leadController.bulkAction);
router.post('/merge', leadController.mergeLeads);

router.get('/:id', leadController.getLead);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);
router.post('/:id/timeline', leadController.addTimelineEntry);

module.exports = router;
