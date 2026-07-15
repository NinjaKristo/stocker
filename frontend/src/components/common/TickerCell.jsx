import { Box, Typography } from '@mui/material';
import TickerLink from './TickerLink';

function TickerCell({ symbol, companyName, industry = null, align = 'left', market = null }) {
  const alignItems = align === 'center' ? 'center' : 'flex-start';
  const textAlign = align === 'center' ? 'center' : 'left';

  if (!symbol) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems,
          gap: 0.25,
          minWidth: 0,
        }}
      >
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{ lineHeight: 1.2 }}
        >
          -
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems,
        gap: 0.25,
        minWidth: 0,
      }}
    >
      <Typography
        component="span"
        variant="body2"
        sx={{ fontWeight: 600, lineHeight: 1.2 }}
      >
        <TickerLink
          symbol={symbol}
          companyName={companyName}
          industry={industry}
          market={market}
        />
      </Typography>
      {companyName ? (
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          title={companyName}
          sx={{
            display: 'block',
            lineHeight: 1.2,
            minWidth: 0,
            maxWidth: '100%',
            textAlign,
          }}
        >
          {companyName}
        </Typography>
      ) : null}
    </Box>
  );
}

export default TickerCell;
