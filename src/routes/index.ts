import { Router } from 'express';
import webhookRoutes from './webhook';

const router = Router();

router.use(webhookRoutes);

export default router;
