import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Fragment, useState } from 'react';

import { getBackplayPresets } from '../../api/backplay';
import {
  createPaperSetup,
  deletePaperSetup,
  evaluatePaperNow,
  listPaperSetups,
  listPaperTrades,
  startPaperSetup,
  stopPaperSetup,
} from '../../api/paper';
import Acronym from '../../components/common/Acronym';
import { formatMoney, formatPct } from './BacktestResults';
import StrategyPicker, { DEFAULT_STRATEGY } from './StrategyPicker';

function tradeDollarProfit(trade) {
  if (trade.exit_price == null || trade.entry_price == null || trade.shares == null) return null;
  return (Number(trade.exit_price) - Number(trade.entry_price)) * Number(trade.shares);
}

function NewSetupDialog({ open, onClose, onCreate, pending, presets }) {
  const [name, setName] = useState('');
  const [sourceKind, setSourceKind] = useState('symbol');
  const [symbol, setSymbol] = useState('');
  const [presetKey, setPresetKey] = useState('');
  const [positionSize, setPositionSize] = useState(10000);
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);

  const validSource = sourceKind === 'symbol' ? symbol.trim() : presetKey;
  const submit = () => onCreate({
    name: name.trim(),
    source_kind: sourceKind,
    symbol: sourceKind === 'symbol' ? symbol.trim().toUpperCase() : null,
    preset_key: sourceKind === 'preset' ? presetKey : null,
    top_n: 10,
    market: 'US',
    strategy,
    position_size: Number(positionSize),
  });

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>New daily paper strategy</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Setup name" value={name} onChange={(event) => setName(event.target.value)} fullWidth />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={sourceKind}
            onChange={(_, value) => value && setSourceKind(value)}
          >
            <ToggleButton value="symbol">Watch one stock</ToggleButton>
            <ToggleButton value="preset"><Acronym term="Scan2Trade">Watch a scan</Acronym></ToggleButton>
          </ToggleButtonGroup>
          {sourceKind === 'symbol' ? (
            <TextField label="Stock symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} sx={{ maxWidth: 240 }} />
          ) : (
            <TextField select label="Scan preset" value={presetKey} onChange={(event) => setPresetKey(event.target.value)} sx={{ maxWidth: 420 }}>
              {(presets || []).map((preset) => <MenuItem key={preset.key} value={preset.key}>{preset.name}</MenuItem>)}
            </TextField>
          )}
          <TextField
            label="Simulated dollars per trade"
            type="number"
            value={positionSize}
            onChange={(event) => setPositionSize(event.target.value)}
            inputProps={{ min: 1, step: 1000 }}
            sx={{ maxWidth: 260 }}
          />
          <StrategyPicker value={strategy} onChange={setStrategy} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={pending || !name.trim() || !validSource || Number(positionSize) <= 0}>
          Start daily monitoring
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PaperTraderPanel() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedTrade, setExpandedTrade] = useState(null);

  const setupsQuery = useQuery({ queryKey: ['paperSetups'], queryFn: listPaperSetups });
  const tradesQuery = useQuery({ queryKey: ['paperTrades'], queryFn: () => listPaperTrades({ limit: 100 }) });
  const presetsQuery = useQuery({ queryKey: ['backplayPresets'], queryFn: getBackplayPresets, staleTime: 300000 });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['paperSetups'] }),
      queryClient.invalidateQueries({ queryKey: ['paperTrades'] }),
    ]);
  };
  const createMutation = useMutation({
    mutationFn: createPaperSetup,
    onSuccess: async () => { setDialogOpen(false); await refresh(); },
  });
  const actionMutation = useMutation({
    mutationFn: ({ action, setupId }) => action(setupId),
    onSuccess: refresh,
  });

  const setups = setupsQuery.data?.setups || [];
  const trades = tradesQuery.data?.trades || [];
  const totalRealized = trades.reduce((sum, trade) => sum + (tradeDollarProfit(trade) || 0), 0);

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}><Acronym term="Paper Trading">Paper Trader</Acronym></Typography>
            <Typography variant="body2" color="text.secondary">
              Active rules check cached market data every weekday after refresh. No broker or real money is connected.
            </Typography>
          </Box>
          <Chip label={`Realized P/L: ${formatMoney(totalRealized, { signed: true })}`} color={totalRealized >= 0 ? 'success' : 'error'} />
          <Button startIcon={<RefreshIcon />} onClick={() => actionMutation.mutate({ action: evaluatePaperNow })} disabled={actionMutation.isPending}>
            Check now
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>New setup</Button>
        </Stack>
      </Paper>

      {(setupsQuery.error || tradesQuery.error || createMutation.error || actionMutation.error) && (
        <Alert severity="error">{createMutation.error?.response?.data?.detail || 'A Paper Trader request failed.'}</Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Daily monitors</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Name / source</TableCell><TableCell>Status</TableCell><TableCell align="right">Open</TableCell><TableCell align="right">Closed</TableCell><TableCell align="right">Avg return</TableCell><TableCell>Last checked</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {setups.map((setup) => (
                <TableRow key={setup.id}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{setup.name}</Typography><Typography variant="caption" color="text.secondary">{setup.source_kind === 'symbol' ? setup.symbol : `Scan: ${setup.preset_key}`}</Typography></TableCell>
                  <TableCell><Chip size="small" color={setup.status === 'active' ? 'success' : 'default'} label={setup.status} /></TableCell>
                  <TableCell align="right">{setup.open_trades ?? 0}</TableCell>
                  <TableCell align="right">{setup.closed_trades ?? 0}</TableCell>
                  <TableCell align="right">{formatPct(setup.avg_return_pct)}</TableCell>
                  <TableCell>{setup.last_evaluated_at ? new Date(setup.last_evaluated_at).toLocaleString() : 'Not yet'}</TableCell>
                  <TableCell align="right">
                    <IconButton aria-label={setup.status === 'active' ? `Stop ${setup.name}` : `Start ${setup.name}`} onClick={() => actionMutation.mutate({ action: setup.status === 'active' ? stopPaperSetup : startPaperSetup, setupId: setup.id })}>{setup.status === 'active' ? <PauseIcon /> : <PlayArrowIcon />}</IconButton>
                    <IconButton aria-label={`Check ${setup.name}`} onClick={() => actionMutation.mutate({ action: evaluatePaperNow, setupId: setup.id })}><RefreshIcon /></IconButton>
                    <IconButton aria-label={`Delete ${setup.name}`} color="error" onClick={() => actionMutation.mutate({ action: deletePaperSetup, setupId: setup.id })}><DeleteOutlineIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!setupsQuery.isLoading && setups.length === 0 && <TableRow><TableCell colSpan={7} align="center">No daily monitors yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Paper trade log</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell /><TableCell>Stock</TableCell><TableCell>Status</TableCell><TableCell>Bought</TableCell><TableCell>Sold</TableCell><TableCell align="right">Return</TableCell><TableCell align="right">Dollar P/L</TableCell><TableCell>Exit</TableCell></TableRow></TableHead>
            <TableBody>
              {trades.map((trade) => (
                <Fragment key={trade.id}>
                  <TableRow>
                    <TableCell><IconButton size="small" aria-label={`Show events for ${trade.symbol}`} onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}><ExpandMoreIcon sx={{ transform: expandedTrade === trade.id ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} /></IconButton></TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{trade.symbol}</TableCell><TableCell>{trade.status}</TableCell><TableCell>{trade.entry_date} @ {formatMoney(trade.entry_price)}</TableCell><TableCell>{trade.exit_date ? `${trade.exit_date} @ ${formatMoney(trade.exit_price)}` : '—'}</TableCell><TableCell align="right">{formatPct(trade.return_pct)}</TableCell><TableCell align="right">{formatMoney(tradeDollarProfit(trade), { signed: true })}</TableCell><TableCell>{trade.exit_reason || '—'}</TableCell>
                  </TableRow>
                  <TableRow><TableCell colSpan={8} sx={{ py: 0 }}><Collapse in={expandedTrade === trade.id} unmountOnExit><Stack spacing={0.5} sx={{ py: 1.5 }}>{(trade.events || []).map((event, index) => <Typography key={`${event.at}-${index}`} variant="caption"><b>{event.at}</b> [{event.kind}] {event.detail}</Typography>)}</Stack></Collapse></TableCell></TableRow>
                </Fragment>
              ))}
              {!tradesQuery.isLoading && trades.length === 0 && <TableRow><TableCell colSpan={8} align="center">No paper trades yet. Active monitors add rows when their entry rule fires.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <NewSetupDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={(payload) => createMutation.mutate(payload)} pending={createMutation.isPending} presets={presetsQuery.data?.presets || []} />
    </Stack>
  );
}

export default PaperTraderPanel;
