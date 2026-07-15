/**
 * TickerLink — a stock symbol that links to its detail page (/stocks/:ticker).
 *
 * Stops click propagation so it works inside rows that have their own click
 * handler (e.g. open-chart on row click). Renders plain text if no symbol.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Tooltip, Typography } from '@mui/material';
import { getStockInfo } from '../../api/stocks';

const profileCache = new Map();

function loadTickerProfile(symbol) {
  const normalized = String(symbol).trim().toUpperCase();
  if (!profileCache.has(normalized)) {
    profileCache.set(
      normalized,
      getStockInfo(normalized).catch(() => null),
    );
  }
  return profileCache.get(normalized);
}

function TickerLink({
  symbol,
  companyName = null,
  industry = null,
  market = null,
  onClick,
  sx,
  underline = 'hover',
  children,
  ...props
}) {
  const [profileRequested, setProfileRequested] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!profileRequested || (companyName && industry)) return undefined;

    let active = true;
    loadTickerProfile(symbol).then((result) => {
      if (active) setProfile(result);
    });
    return () => {
      active = false;
    };
  }, [companyName, industry, profileRequested, symbol]);

  if (!symbol) return children ?? null;

  const resolvedCompanyName = companyName || profile?.name;
  const resolvedIndustry = industry || profile?.industry;
  const resolvedSector = profile?.sector;
  const profileLoading = profileRequested && !profile && (!companyName || !industry);

  const tooltip = (
    <Box sx={{ maxWidth: 300 }}>
      <Typography variant="subtitle2" component="div" sx={{ fontWeight: 700 }}>
        {symbol}
      </Typography>
      {resolvedCompanyName && (
        <Typography variant="body2" component="div">
          {resolvedCompanyName}
        </Typography>
      )}
      {resolvedIndustry && (
        <Typography variant="caption" component="div" sx={{ mt: 0.25, opacity: 0.9 }}>
          Industry: {resolvedIndustry}
        </Typography>
      )}
      {!resolvedIndustry && resolvedSector && (
        <Typography variant="caption" component="div" sx={{ mt: 0.25, opacity: 0.9 }}>
          Sector: {resolvedSector}
        </Typography>
      )}
      {!resolvedCompanyName && (
        <Typography variant="body2" component="div" sx={{ opacity: 0.82 }}>
          {profileLoading ? 'Loading company profile...' : 'Company profile unavailable.'}
        </Typography>
      )}
      <Typography variant="caption" component="div" sx={{ mt: 0.5, opacity: 0.72 }}>
        {market ? `${market} market. ` : ''}Click to open the stock detail page.
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
      onOpen={() => setProfileRequested(true)}
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
