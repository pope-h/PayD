import { Router } from 'express';
import { ForecastController } from '../controllers/forecastController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization, authorizeRoles } from '../middlewares/rbac.js';

const router = Router();

router.use(authenticateJWT);
router.use(isolateOrganization);

router.get('/', authorizeRoles('EMPLOYER'), ForecastController.getForecast);

router.get('/settings', authorizeRoles('EMPLOYER'), ForecastController.getLiquiditySettings);
router.put('/settings', authorizeRoles('EMPLOYER'), ForecastController.updateLiquiditySettings);

export default router;
