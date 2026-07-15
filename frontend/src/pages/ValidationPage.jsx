import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import { getValidationOverview } from '../api/validation';
import { ValidationSection } from '../components/Validation/ValidationPanels';
import Acronym from '../components/common/Acronym';
import PaperTraderPanel from '../features/backplay/PaperTraderPanel';
import ReplayPanel from '../features/backplay/ReplayPanel';
import ScanTopTenPanel from '../features/backplay/ScanTopTenPanel';
import StrategyTestPanel from '../features/backplay/StrategyTestPanel';

const LOOKBACK_OPTIONS = [30, 90, 180];

function ValidationPage() {
  const [section, setSection] = useState('scorecard');
  const [backplayMode, setBackplayMode] = useState('replay');
  const [sourceKind, setSourceKind] = useState('scan_pick');
  const [lookbackDays, setLookbackDays] = useState(90);

  const { data, isLoading, error } = useQuery({
    queryKey: ['validationOverview', sourceKind, lookbackDays],
    queryFn: () => getValidationOverview(sourceKind, lookbackDays),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
    enabled: section === 'scorecard',
  });

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Validation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grade past signals, replay charts without hindsight, test dated strategies, or keep a
            rule running daily with simulated money.
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={section}
            onChange={(_, value) => value && setSection(value)}
            aria-label="Backtest section"
          >
            <ToggleButton value="scorecard">Scorecard</ToggleButton>
            <ToggleButton value="backplay"><Acronym term="Backplay" /></ToggleButton>
            <ToggleButton value="paper"><Acronym term="Paper Trading">Paper Trader</Acronym></ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {section === 'scorecard' && (
        <>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                The scorecard measures what happened after published scan picks and theme alerts.
              </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Source
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={sourceKind}
                onChange={(_, value) => value && setSourceKind(value)}
              >
                <ToggleButton value="scan_pick">Scan Picks</ToggleButton>
                <ToggleButton value="theme_alert">Theme Alerts</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Lookback
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={lookbackDays}
                onChange={(_, value) => value && setLookbackDays(value)}
              >
                {LOOKBACK_OPTIONS.map((value) => (
                  <ToggleButton key={value} value={value}>{value}D</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Stack>
          {isLoading && (
            <Box display="flex" justifyContent="center">
              <CircularProgress size={24} />
            </Box>
          )}
            </Stack>
          </Paper>

          {error && <Alert severity="error">Failed to load validation overview: {error.message}</Alert>}

          {data && (
            <ValidationSection
              degradedReasons={data.degraded_reasons}
              horizons={data.horizons}
              recentEvents={data.recent_events}
              failureClusters={data.failure_clusters}
            />
          )}
        </>
      )}

      {section === 'backplay' && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={backplayMode}
              onChange={(_, value) => value && setBackplayMode(value)}
              aria-label="Backplay mode"
            >
              <ToggleButton value="replay"><Acronym term="Bar Replay">Replay</Acronym></ToggleButton>
              <ToggleButton value="strategy">Strategy Test</ToggleButton>
              <ToggleButton value="scan"><Acronym term="Scan2Trade">Scan Top 10</Acronym></ToggleButton>
            </ToggleButtonGroup>
            <Divider sx={{ mt: 1.5 }} />
          </Paper>
          {backplayMode === 'replay' && <ReplayPanel />}
          {backplayMode === 'strategy' && <StrategyTestPanel />}
          {backplayMode === 'scan' && <ScanTopTenPanel />}
        </Stack>
      )}

      {section === 'paper' && <PaperTraderPanel />}
    </Stack>
  );
}

export default ValidationPage;
