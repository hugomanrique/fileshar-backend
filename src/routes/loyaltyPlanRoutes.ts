import express, { Router } from 'express'
import {
  getLoyaltyPlans,
  getLoyaltyRedemptions,
  getClientRedemptionStatus,
  createLoyaltyPlan,
  updateLoyaltyPlan,
  deleteLoyaltyPlan,
  redeemLoyaltyPlan,
} from '../controllers/loyaltyPlanController'

const router: Router = express.Router()

router.get('/loyalty-plans', getLoyaltyPlans)
router.get('/loyalty-plans/redemptions', getLoyaltyRedemptions)
router.get('/loyalty-plans/client-status/:clientId', getClientRedemptionStatus)
router.post('/loyalty-plans', createLoyaltyPlan)
router.patch('/loyalty-plans/:id', updateLoyaltyPlan)
router.delete('/loyalty-plans/:id', deleteLoyaltyPlan)
router.post('/loyalty-plans/:id/redeem', redeemLoyaltyPlan)

export default router
