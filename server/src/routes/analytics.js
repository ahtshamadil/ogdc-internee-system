import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import {
  getTotals,
  getPeriodComparison,
  getTrend,
  getBreakdown,
  getMatrix,
  getAttention,
  getSparkline,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
} from '../services/analyticsService.js';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/dimensions',
  asyncHandler(async (_req, res) => {
    res.json({ dimensions: DIMENSION_KEYS.map((value) => ({ value, label: DIMENSION_LABELS[value] })) });
  }),
);

/**
 * One call powers the whole dashboard above the fold, so a filter change is a
 * single round trip rather than six racing requests.
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json({
      totals: getTotals(req.query),
      periods: getPeriodComparison(req.query),
      sparkline: getSparkline(req.query),
      likeForLike: req.query.like_for_like !== 'false',
    });
  }),
);

router.get(
  '/trend',
  asyncHandler(async (req, res) => {
    res.json(getTrend(req.query));
  }),
);

router.get(
  '/breakdown',
  asyncHandler(async (req, res) => {
    res.json(getBreakdown(req.query));
  }),
);

/** Several breakdowns at once, so the dashboard grid loads in one request. */
router.get(
  '/breakdowns',
  asyncHandler(async (req, res) => {
    const requested = String(req.query.dimensions || 'university,degree,city,department')
      .split(',')
      .map((d) => d.trim())
      .filter((d) => DIMENSION_KEYS.includes(d));

    const result = {};
    for (const dim of requested) {
      result[dim] = getBreakdown({ ...req.query, dimension: dim, limit: req.query.limit || 12 });
    }
    res.json({ breakdowns: result });
  }),
);

router.get(
  '/matrix',
  asyncHandler(async (req, res) => {
    res.json(getMatrix(req.query));
  }),
);

router.get(
  '/attention',
  asyncHandler(async (req, res) => {
    res.json(getAttention(req.query));
  }),
);

export default router;
