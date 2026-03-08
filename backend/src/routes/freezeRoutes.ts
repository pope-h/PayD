import { Router } from 'express';
import { FreezeController } from '../controllers/freezeController.js';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware.js';

const router = Router();

// Apply a slightly stricter rate limit for administrative actions
const adminRateLimit = rateLimitMiddleware({ tier: 'api' });

// ---------------------------------------------------------------------------
// Account-level Freeze Operations
// ---------------------------------------------------------------------------

/**
 * @route POST /api/v1/freeze/account/freeze
 * @desc Freeze a single account's trustline for an asset
 * @access Admin (Requires issuerSecret)
 */
router.post('/account/freeze', adminRateLimit, FreezeController.freezeAccount);

/**
 * @route POST /api/v1/freeze/account/unfreeze
 * @desc Restore a single account's trustline for an asset
 * @access Admin (Requires issuerSecret)
 */
router.post('/account/unfreeze', adminRateLimit, FreezeController.unfreezeAccount);

// ---------------------------------------------------------------------------
// Global Freeze Operations (All Holders)
// ---------------------------------------------------------------------------

/**
 * @route POST /api/v1/freeze/global/freeze
 * @desc Pause transfers for ALL accounts holding the specified asset globally
 * @access Admin (Requires issuerSecret)
 */
router.post('/global/freeze', adminRateLimit, FreezeController.freezeGlobal);

/**
 * @route POST /api/v1/freeze/global/unfreeze
 * @desc Restore transfers for ALL accounts holding the specified asset globally
 * @access Admin (Requires issuerSecret)
 */
router.post('/global/unfreeze', adminRateLimit, FreezeController.unfreezeGlobal);

// ---------------------------------------------------------------------------
// Status & Audit
// ---------------------------------------------------------------------------

/**
 * @route GET /api/v1/freeze/status/:targetAccount
 * @desc Query the active freeze status of an account's trustline
 * @query { assetCode, assetIssuer }
 */
router.get('/status/:targetAccount', FreezeController.checkStatus);

/**
 * @route GET /api/v1/freeze/logs
 * @desc Paginated history of all freeze and unfreeze actions
 * @query { page, limit, targetAccount, action, assetCode }
 */
router.get('/logs', FreezeController.getLogs);

export default router;
