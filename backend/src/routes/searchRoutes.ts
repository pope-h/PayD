import { Router } from 'express';
import searchController from '../controllers/searchController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';
import { requireTenantContext } from '../middleware/tenantContext.js';

const router = Router();

// Apply global authentication and isolation to all search routes
router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @route GET /api/search/organizations/:organizationId/employees
 * @desc Search and filter employees
 */
router.get(
  '/organizations/:organizationId/employees',
  requireTenantContext,
  searchController.searchEmployees.bind(searchController)
);

/**
 * @route GET /api/search/organizations/:organizationId/transactions
 * @desc Search and filter transactions
 */
router.get(
  '/organizations/:organizationId/transactions',
  requireTenantContext,
  searchController.searchTransactions.bind(searchController)
);

export default router;
