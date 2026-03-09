import { Router } from 'express';
import { CashFlowForecastController } from '../controllers/cashFlowForecastController.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

/**
 * @route GET /api/cash-flow/forecast
 * @desc Generate comprehensive cash flow forecast
 * @query forecastDays - Number of days to forecast (default: 90, max: 365)
 * @query distributionAccount - Stellar distribution account public key (required)
 * @query assetIssuer - ORGUSD asset issuer public key (required)
 * @access Private (requires authentication)
 */
router.get('/forecast', authenticateJWT, CashFlowForecastController.getForecast);

/**
 * @route GET /api/cash-flow/historical
 * @desc Get historical payroll data analysis
 * @query monthsBack - Number of months to analyze (default: 6, max: 24)
 * @access Private (requires authentication)
 */
router.get('/historical', authenticateJWT, CashFlowForecastController.getHistorical);

/**
 * @route GET /api/cash-flow/projections
 * @desc Get upcoming scheduled payroll projections
 * @query forecastDays - Number of days to project (default: 90, max: 365)
 * @access Private (requires authentication)
 */
router.get('/projections', authenticateJWT, CashFlowForecastController.getProjections);

/**
 * @route GET /api/cash-flow/alerts
 * @desc Get budget alerts for the organization
 * @query forecastDays - Number of days to forecast (default: 90, max: 365)
 * @query distributionAccount - Stellar distribution account public key (required)
 * @query assetIssuer - ORGUSD asset issuer public key (required)
 * @access Private (requires authentication)
 */
router.get('/alerts', authenticateJWT, CashFlowForecastController.getAlerts);

export default router;
