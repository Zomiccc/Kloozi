const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const t = require('../controllers/templateController');

router.use(authenticate);

router.get('/', t.list);
router.post('/', t.create);
router.post('/import', t.importTemplate);
router.post('/preview', t.previewDraft);
router.get('/:id', t.get);
router.put('/:id', t.update);
router.delete('/:id', t.remove);
router.get('/:id/preview', t.preview);
router.get('/:id/export', t.exportTemplate);
router.post('/:id/duplicate', t.duplicate);
router.post('/:id/use', t.use);

module.exports = router;
