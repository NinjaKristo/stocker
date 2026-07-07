/**
 * TickerLink — a stock symbol that links to its detail page (/stocks/:ticker).
 *
 * Stops click propagation so it works inside rows that have their own click
 * handler (e.g. open-chart on row click). Renders plain text if no symbol.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Tooltip, Typography } from '@mui/material';

function TickerLink({
  symbol,
  companyName = null,
  market = null,
  onClick,
  sx,
  underline = 'hover',
  children,
  ...props
}) {
  if (!symbol) return children ?? null;

  const tooltip = (
    <Box sx={{ maxWidth: 300 }}>
      <Typography variant="subtitle2" component="div" sx={{ fontWeight: 700 }}>
        {symbol}
      </Typography>
      {companyName && (
        <Typography variant="body2" component="div">
          {companyName}
        </Typography>
      )}
      <Typography variant="caption" component="div" sx={{ mt: 0.5, opacity: 0.82 }}>
        {market ? `${market} ticker` : 'Ticker symbol'} - click to open the stock detail page.
      </Typography>
    </Box>
  );

  const link = (
    <Link
      component={RouterLink}
      to={`/stocks/${encodeURIComponent(symbol)}`}
      underline={underline}
      color="inherit"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      sx={{ fontWeight: 600, cursor: 'pointer', ...sx }}
      {...props}
    >
      {children ?? symbol}
    </Link>
  );

  return (
    <Tooltip
      title={tooltip}
      arrow
      enterDelay={700}
      enterNextDelay={400}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'rgba(30, 30, 30, 0.85)',
            backdropFilter: 'blur(2px)',
            px: 1.5,
            py: 1,
          },
        },
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', minWidth: 0 }}>
        {link}
      </Box>
    </Tooltip>
  );
}

export default TickerLink;
