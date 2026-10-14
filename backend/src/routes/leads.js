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

const interestController = require('../controllers/interestController');
router.get('/:id/interest', interestController.getLeadInterest);
router.post('/:id/interest/brief', interestController.getBrief);
router.get('/:id/tracked-link', interestController.trackedLink);
// "Request an update" — manager nudges the assigned member (services/updateRequestService.js)
const updateRequests = require('../services/updateRequestService');
const urWrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) {
    if (err instanceof updateRequests.RequestError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};
router.get('/update-requests/open', urWrap(async (req, res) => {
  res.json({ lead_ids: await updateRequests.openLeadIds(req.workspaceId) });
}));
router.get('/:id/update-request', urWrap(async (req, res) => {
  res.json({ request: await updateRequests.openFor(req.params.id, req.workspaceId) });
}));
router.post('/:id/update-request', requireManagerOrAbove, urWrap(async (req, res) => {
  const out = await updateRequests.requestUpdate({ workspaceId: req.workspaceId, leadId: req.params.id, user: req.user, note: req.body?.note });
  res.status(out.already ? 200 : 201).json(out);
}));
router.delete('/:id/update-request', requireManagerOrAbove, urWrap(async (req, res) => {
  res.json({ cleared: await updateRequests.clearRequest({ workspaceId: req.workspaceId, leadId: req.params.id, user: req.user }) });
}));

router.get('/:id', leadController.getLead);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);
router.post('/:id/timeline', leadController.addTimelineEntry);

module.exports = router;
