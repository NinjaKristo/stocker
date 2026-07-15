import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';

const steps = [
  {
    label: '1. Find',
    text: 'Favor themes with rising momentum, multiple constituents, and more than one supporting source.',
  },
  {
    label: '2. Verify',
    text: 'Open the theme to inspect its stocks and evidence. Avoid single-stock spikes, stale stories, and hype without price confirmation.',
  },
  {
    label: '3. Test',
    text: 'Choose a liquid stock with a defined setup, then validate or backtest the entry and exit rules. A theme is context, not a buy signal.',
  },
];

export default function ThemeTutorial() {
  return (
    <Accordion defaultExpanded variant="outlined" sx={{ mb: 2.5 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SchoolOutlinedIcon color="info" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            What is a theme, and how do I use it?
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 980 }}>
          A theme is an investable narrative or catalyst shared by companies, such as AI infrastructure
          or grid modernization. Unlike an industry, it can span several sectors. Technical themes are
          confirmed by price and momentum; fundamental themes are supported by earnings, valuation,
          macro data, and research coverage.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.25 }}>
          {steps.map((step) => (
            <Box key={step.label} sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Chip label={step.label} size="small" color="info" variant="outlined" sx={{ mb: 0.75 }} />
              <Typography variant="body2">{step.text}</Typography>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
