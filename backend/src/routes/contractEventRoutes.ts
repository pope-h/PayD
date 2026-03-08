import { Router } from 'express';
import { ContractEventController } from '../controllers/contractEventController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

// Apply authentication to all event routes
router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @route GET /api/events/indexer/status
 */
router.get(
  '/indexer/status',
  ContractEventController.getIndexerStatus
);

/**
 * @route GET /api/events/:contractId
 */
router.get(
  '/:contractId',
  ContractEventController.getEventsByContract
);

/**
 * @route GET /api/events
 */
router.get(
  '/',
  ContractEventController.getAllEvents
);

export default router;
