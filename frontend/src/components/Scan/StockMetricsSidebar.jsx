import { Box, Typography, Divider, Chip, Button, Tooltip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  getStageColor,
  getRatingColor,
  getGrowthColorHex,
  getEpsRatingColor,
} from '../../utils/colorUtils';
import { formatPercent, formatRatio, formatPatternName, getScoreColor } from '../../utils/formatUtils';
import { resolveMarketCapDisplay } from '../../utils/marketCapUtils';

// Alias for this component's usage (uses hex colors)
const getGrowthColor = getGrowthColorHex;

/**
 * RS Trend icon component
 */
const RSTrendIcon = ({ trend }) => {
  if (trend === 1) return <TrendingUpIcon sx={{ fontSize: 16, color: '#4caf50' }} />;
  if (trend === -1) return <TrendingDownIcon sx={{ fontSize: 16, color: '#f44336' }} />;
  return <TrendingFlatIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />;
};

/**
 * Boolean indicator (checkmark or X)
 */
const BoolIndicator = ({ value }) => {
  if (value) return <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />;
  return <CancelIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />;
};

// Hover help for every sidebar stat: plain definition, then why it matters last.
const METRIC_TIPS = {
  Composite: 'Blended score across the selected screeners (0–100); higher = more methods agree. Purpose: one number to rank the whole scan.',
  'EPS Rating': 'IBD-style 1–99 rank of earnings growth & stability vs every stock (99 = top 1%). Purpose: flags the earnings power that fuels big moves.',
  Minervini: 'How well the stock fits Minervini’s Trend Template (Stage-2 uptrend, MA alignment, well off lows). Purpose: screens for classic momentum-leader structure.',
  CANSLIM: 'O’Neil CANSLIM fit: earnings, new highs, relative strength, volume, institutional ownership. Purpose: finds growth leaders early in their run.',
  IPO: 'Strength score for recent IPOs (base structure and RS since listing). Purpose: surfaces young leaders before the crowd.',
  Custom: 'Score from your own custom filter criteria. Purpose: rank stocks against your personal rules.',
  'Vol Break': 'Volume Breakthrough: unusual up-volume vs the stock’s own history. Purpose: spots institutional accumulation and breakouts.',
  'RS Rating': 'Relative Strength 1–99: price performance vs the whole market over ~1yr (80+ = leader). Purpose: leaders keep leading; laggards rarely become leaders.',
  'RS 1M': 'Relative strength over the trailing 1 month. Purpose: shows if strength is fresh.',
  'RS 3M': 'Relative strength over the trailing 3 months. Purpose: intermediate-term leadership.',
  'RS 12M': 'Relative strength over the trailing 12 months. Purpose: durable, long-run leadership.',
  Beta: 'Volatility vs the market (1.0 = moves the same). Purpose: gauges risk and expected swing size.',
  'β-adj RS': 'Relative strength adjusted for beta — outperformance beyond what its volatility explains. Purpose: rewards genuine strength, not just high beta.',
  'EPS Q/Q': 'Latest-quarter EPS growth vs the year-ago quarter. Purpose: the “C” in CANSLIM — accelerating earnings drive breakouts.',
  'Sales Q/Q': 'Latest-quarter revenue growth vs a year ago. Purpose: confirms earnings growth is real, not just cost-cutting.',
  'EPS Y/Y': 'Annual EPS growth year over year. Purpose: shows a durable earnings trend.',
  'Sales Y/Y': 'Annual revenue growth year over year. Purpose: sustained end-demand.',
  'EPS TTM': 'Trailing-twelve-month EPS growth. Purpose: smooths quarterly noise.',
  'Rev Growth': 'Overall revenue growth rate. Purpose: underlying business momentum.',
  'P/E': 'Price ÷ trailing earnings per share. Purpose: how richly current earnings are valued.',
  'Fwd P/E': 'Price ÷ next-year expected EPS. Purpose: valuation on future earnings.',
  PEG: 'P/E ÷ earnings growth rate (~1 = fair). Purpose: values growth, not just earnings.',
  ROE: 'Return on equity — profit per $ of shareholder capital. Purpose: quality and efficiency of the business.',
  Profit: 'Net profit margin. Purpose: pricing power and operating quality.',
  'Inst Own': '% of shares held by institutions. Purpose: the “I” in CANSLIM — sponsorship fuels demand, though too high can mean crowded.',
  Detected: 'Whether a Volatility Contraction Pattern was found. Purpose: tight, low-volume pullbacks often precede breakouts.',
  Score: 'Strength/quality of the detected VCP (0–100). Purpose: rank how textbook the contraction is.',
  Pivot: 'The buy-point price where the pattern completes. Purpose: your entry trigger.',
  Ready: 'Whether price is at/near the breakout pivot. Purpose: timing — actionable now vs still building.',
  Pattern: 'Primary chart setup detected (e.g. flat base, cup-with-handle). Purpose: names the structure you’re trading.',
  Confidence: 'Model confidence in the detected pattern. Purpose: how much to trust the read.',
  Setup: 'Setup Engine setup score. Purpose: how well-formed the entry is.',
  Quality: 'Setup Engine quality score. Purpose: structural soundness of the base.',
  Readiness: 'Setup Engine readiness score. Purpose: proximity to an actionable trigger.',
  Price: 'Latest closing price. Purpose: current level for position sizing and pivots.',
  Stage: 'Weinstein stage: 1 base, 2 advancing, 3 topping, 4 declining. Purpose: only Stage-2 names are in healthy uptrends.',
  'MA Align': 'Whether the 50 > 150 > 200-day moving averages are stacked bullishly. Purpose: confirms a real uptrend.',
  'Pass Tmpl': 'Passes Minervini’s full Trend Template. Purpose: quick yes/no on trend-leader eligibility.',
};

function tipFor(label) {
  if (METRIC_TIPS[label]) return METRIC_TIPS[label];
  if (typeof label === 'string' && /cap/i.test(label)) {
    return 'Total equity value (price × shares). Purpose: size/liquidity tier — small caps move more, large caps are steadier.';
  }
  return null;
}

/**
 * A stat label that shows a definition + purpose tooltip on hover.
 */
const TipLabel = ({ label }) => {
  const tip = tipFor(label);
  const node = (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        fontSize: '0.75rem',
        ...(tip ? { cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: '2px' } : {}),
      }}
    >
      {label}
    </Typography>
  );
  if (!tip) return node;
  return (
    <Tooltip arrow title={tip} placement="left" enterDelay={200}>
      {node}
    </Tooltip>
  );
};

/**
 * Metric row component for 2-column grid
 */
const MetricRow = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <TipLabel label={label} />
    <Typography variant="body2" fontWeight="medium" sx={{ color: color || 'text.primary', fontSize: '0.8rem' }}>
      {value}
    </Typography>
  </Box>
);

/**
 * Section header component
 */
const SectionHeader = ({ children }) => (
  <Typography
    variant="caption"
    color="text.secondary"
    sx={{ fontWeight: 'bold', letterSpacing: 0.5, fontSize: '0.65rem', mb: 0.5, display: 'block' }}
  >
    {children}
  </Typography>
);

/**
 * Stock metrics sidebar for chart viewer modal
 * Displays all screener scores, key metrics, and fundamentals in a compact 2-column layout
 *
 * @param {Object} props
 * @param {Object} props.stockData - Stock result data from scan (optional for watchlists)
 * @param {Object} props.fundamentals - Fundamentals data from cache
 */
function StockMetricsSidebar({
  stockData,
  fundamentals,
  width = 450,
  height = '100%',
  onViewPeers,
  onViewSetupDetails,
}) {
  // Show loading only if neither stockData nor fundamentals are available
  if (!stockData && !fundamentals) {
    return (
      <Box sx={{ p: 2, width }}>
        <Typography variant="body2" color="text.secondary">
          Loading stock data...
        </Typography>
      </Box>
    );
  }

  const marketCapMetric = resolveMarketCapDisplay(stockData, fundamentals, { preferUsd: true });

  // Minimal view when only fundamentals are available (e.g., watchlists)
  if (!stockData && fundamentals) {
    return (
      <Box
        sx={{
          width,
          height,
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {/* Header */}
        <Box>
          <Typography variant="body2" fontWeight="medium" sx={{ lineHeight: 1.3 }}>
            {fundamentals.symbol}
          </Typography>
        </Box>

        {/* About - Company Description */}
        {fundamentals?.description && (
          <Box>
            <SectionHeader>ABOUT</SectionHeader>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.75rem',
                lineHeight: 1.5,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {fundamentals.description}
            </Typography>
          </Box>
        )}

        <Divider />

        {/* Growth */}
        <Box>
          <SectionHeader>GROWTH</SectionHeader>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
            <MetricRow
              label="EPS Q/Q"
              value={formatPercent(fundamentals.eps_growth_qq)}
              color={getGrowthColor(fundamentals.eps_growth_qq)}
            />
            <MetricRow
              label="Sales Q/Q"
              value={formatPercent(fundamentals.sales_growth_qq)}
              color={getGrowthColor(fundamentals.sales_growth_qq)}
            />
            <MetricRow
              label="EPS TTM"
              value={formatPercent(fundamentals.eps_growth_annual)}
              color={getGrowthColor(fundamentals.eps_growth_annual)}
            />
            <MetricRow
              label="Rev Growth"
              value={formatPercent(fundamentals.revenue_growth)}
              color={getGrowthColor(fundamentals.revenue_growth)}
            />
          </Box>
        </Box>

        <Divider />

        {/* Valuation */}
        <Box>
          <SectionHeader>VALUATION</SectionHeader>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
            <MetricRow label={marketCapMetric.label} value={marketCapMetric.formattedValue} />
            <MetricRow label="P/E" value={formatRatio(fundamentals.pe_ratio)} />
            <MetricRow label="Fwd P/E" value={formatRatio(fundamentals.forward_pe)} />
            <MetricRow label="PEG" value={formatRatio(fundamentals.peg_ratio)} />
            <MetricRow
              label="ROE"
              value={fundamentals.roe != null ? `${fundamentals.roe.toFixed(1)}%` : '-'}
            />
            <MetricRow
              label="Profit"
              value={fundamentals.profit_margin != null ? `${fundamentals.profit_margin.toFixed(1)}%` : '-'}
            />
            <MetricRow
              label="Inst Own"
              value={fundamentals.institutional_ownership != null ? `${fundamentals.institutional_ownership.toFixed(1)}%` : '-'}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  const showSetupSection =
    stockData?.se_setup_score != null ||
    stockData?.se_quality_score != null ||
    stockData?.se_readiness_score != null ||
    stockData?.se_pattern_primary != null ||
    stockData?.se_setup_ready != null ||
    stockData?.se_explain != null ||
    (Array.isArray(stockData?.se_candidates) && stockData.se_candidates.length > 0) ||
    stockData?.screeners_run?.includes('setup_engine');

  return (
    <Box
      sx={{
        width,
        height,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        overflow: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* Header: Company Name + Rating */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography variant="body2" fontWeight="medium" sx={{ flex: 1, lineHeight: 1.3 }}>
          {stockData.company_name || stockData.symbol}
        </Typography>
        {stockData.rating && (
          <Chip
            label={stockData.rating}
            color={getRatingColor(stockData.rating)}
            size="small"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        )}
      </Box>

      {/* About - Company Description */}
      {fundamentals?.description && (
        <Box>
          <SectionHeader>ABOUT</SectionHeader>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: '0.75rem',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {fundamentals.description}
          </Typography>
        </Box>
      )}

      <Divider />

      {/* Scores - Composite + Screener Scores combined */}
      <Box>
        <SectionHeader>SCORES</SectionHeader>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          <MetricRow
            label="Composite"
            value={stockData.composite_score?.toFixed(1) || '-'}
            color="primary.main"
          />
          <MetricRow
            label="EPS Rating"
            value={stockData.eps_rating != null ? stockData.eps_rating : '-'}
            color={getEpsRatingColor(stockData.eps_rating)}
          />
          <MetricRow label="Minervini" value={stockData.minervini_score?.toFixed(1) || '-'} />
          <MetricRow label="CANSLIM" value={stockData.canslim_score?.toFixed(1) || '-'} />
          <MetricRow label="IPO" value={stockData.ipo_score?.toFixed(1) || '-'} />
          <MetricRow label="Custom" value={stockData.custom_score?.toFixed(1) || '-'} />
          <MetricRow label="Vol Break" value={stockData.volume_breakthrough_score?.toFixed(1) || '-'} />
        </Box>
      </Box>

      <Divider />

      {/* Relative Strength - 2 column grid */}
      <Box>
        <SectionHeader>RELATIVE STRENGTH</SectionHeader>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <TipLabel label="RS Rating" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.8rem' }}>
                {stockData.rs_rating?.toFixed(1) || '-'}
              </Typography>
              <RSTrendIcon trend={stockData.rs_trend} />
            </Box>
          </Box>
          <MetricRow label="RS 1M" value={stockData.rs_rating_1m?.toFixed(1) || '-'} />
          <MetricRow label="RS 3M" value={stockData.rs_rating_3m?.toFixed(1) || '-'} />
          <MetricRow label="RS 12M" value={stockData.rs_rating_12m?.toFixed(1) || '-'} />
          <MetricRow label="Beta" value={stockData.beta?.toFixed(2) || '-'} />
          <MetricRow label="β-adj RS" value={stockData.beta_adj_rs?.toFixed(0) || '-'} />
        </Box>
      </Box>

      <Divider />

      {/* Growth - 2 column grid with colors */}
      <Box>
        <SectionHeader>GROWTH</SectionHeader>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          <MetricRow
            label="EPS Q/Q"
            value={formatPercent(stockData.eps_growth_qq ?? fundamentals?.eps_growth_qq)}
            color={getGrowthColor(stockData.eps_growth_qq ?? fundamentals?.eps_growth_qq)}
          />
          <MetricRow
            label="Sales Q/Q"
            value={formatPercent(stockData.sales_growth_qq ?? fundamentals?.sales_growth_qq)}
            color={getGrowthColor(stockData.sales_growth_qq ?? fundamentals?.sales_growth_qq)}
          />
          <MetricRow
            label="EPS Y/Y"
            value={formatPercent(stockData.eps_growth_yy ?? fundamentals?.eps_growth_yy)}
            color={getGrowthColor(stockData.eps_growth_yy ?? fundamentals?.eps_growth_yy)}
          />
          <MetricRow
            label="Sales Y/Y"
            value={formatPercent(stockData.sales_growth_yy ?? fundamentals?.sales_growth_yy)}
            color={getGrowthColor(stockData.sales_growth_yy ?? fundamentals?.sales_growth_yy)}
          />
          <MetricRow
            label="EPS TTM"
            value={formatPercent(fundamentals?.eps_growth_annual)}
            color={getGrowthColor(fundamentals?.eps_growth_annual)}
          />
          <MetricRow
            label="Rev Growth"
            value={formatPercent(fundamentals?.revenue_growth)}
            color={getGrowthColor(fundamentals?.revenue_growth)}
          />
        </Box>
      </Box>

      <Divider />

      {/* Valuation (from fundamentals) - 2 column grid */}
      <Box>
        <SectionHeader>VALUATION</SectionHeader>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          <MetricRow label={marketCapMetric.label} value={marketCapMetric.formattedValue} />
          <MetricRow label="P/E" value={formatRatio(fundamentals?.pe_ratio)} />
          <MetricRow label="Fwd P/E" value={formatRatio(fundamentals?.forward_pe)} />
          <MetricRow label="PEG" value={formatRatio(fundamentals?.peg_ratio)} />
          <MetricRow
            label="ROE"
            value={fundamentals?.roe != null ? `${fundamentals.roe.toFixed(1)}%` : '-'}
          />
          <MetricRow
            label="Profit"
            value={fundamentals?.profit_margin != null ? `${fundamentals.profit_margin.toFixed(1)}%` : '-'}
          />
          <MetricRow
            label="Inst Own"
            value={fundamentals?.institutional_ownership != null ? `${fundamentals.institutional_ownership.toFixed(1)}%` : '-'}
          />
        </Box>
      </Box>

      {/* VCP Pattern - Conditional, 2 column grid */}
      {stockData.vcp_detected && (
        <>
          <Divider />
          <Box>
            <SectionHeader>VCP PATTERN</SectionHeader>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <TipLabel label="Detected" />
                <BoolIndicator value={stockData.vcp_detected} />
              </Box>
              <MetricRow label="Score" value={stockData.vcp_score?.toFixed(1) || '-'} />
              <MetricRow
                label="Pivot"
                value={stockData.vcp_pivot ? `$${stockData.vcp_pivot.toFixed(2)}` : '-'}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <TipLabel label="Ready" />
                <BoolIndicator value={stockData.vcp_ready_for_breakout} />
              </Box>
            </Box>
          </Box>
        </>
      )}

      {/* Setup Engine - Conditional, 2 column grid */}
      {showSetupSection && (
        <>
          <Divider />
          <Box>
            <SectionHeader>SETUP ENGINE</SectionHeader>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
              <MetricRow
                label="Pattern"
                value={formatPatternName(stockData.se_pattern_primary)}
              />
              <MetricRow
                label="Confidence"
                value={stockData.se_pattern_confidence != null ? `${stockData.se_pattern_confidence.toFixed(0)}%` : '-'}
              />
              <MetricRow
                label="Setup"
                value={stockData.se_setup_score?.toFixed(1) || '-'}
                color={getScoreColor(stockData.se_setup_score)}
              />
              <MetricRow
                label="Quality"
                value={stockData.se_quality_score?.toFixed(1) || '-'}
                color={getScoreColor(stockData.se_quality_score)}
              />
              <MetricRow
                label="Readiness"
                value={stockData.se_readiness_score?.toFixed(1) || '-'}
                color={getScoreColor(stockData.se_readiness_score)}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <TipLabel label="Ready" />
                <BoolIndicator value={stockData.se_setup_ready} />
              </Box>
            </Box>
            {onViewSetupDetails && (
              <Button
                variant="outlined"
                size="small"
                fullWidth
                startIcon={<InfoOutlinedIcon />}
                onClick={onViewSetupDetails}
                sx={{ textTransform: 'none', mt: 1, fontSize: '0.75rem' }}
              >
                View Setup Details
              </Button>
            )}
          </Box>
        </>
      )}

      <Divider />

      {/* Price & Technical - 2 column grid */}
      <Box>
        <SectionHeader>PRICE & TECHNICAL</SectionHeader>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          <MetricRow
            label="Price"
            value={stockData.current_price ? `$${stockData.current_price.toFixed(2)}` : '-'}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <TipLabel label="Stage" />
            {stockData.stage ? (
              <Chip
                label={`S${stockData.stage}`}
                size="small"
                sx={{
                  backgroundColor: getStageColor(stockData.stage),
                  color: 'white',
                  fontSize: '0.65rem',
                  height: 18,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            ) : (
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>-</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <TipLabel label="MA Align" />
            <BoolIndicator value={stockData.ma_alignment} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <TipLabel label="Pass Tmpl" />
            <BoolIndicator value={stockData.passes_template} />
          </Box>
        </Box>
      </Box>

      {/* View Industry Peers Button */}
      {stockData.ibd_industry_group && onViewPeers && (
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<PeopleIcon />}
          onClick={onViewPeers}
          sx={{ textTransform: 'none', mt: 'auto' }}
        >
          View Industry Peers
        </Button>
      )}
    </Box>
  );
}

export default StockMetricsSidebar;
