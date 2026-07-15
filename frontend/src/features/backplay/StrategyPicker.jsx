/**
 * StrategyPicker — choose the trading rule for a backtest or paper setup.
 *
 * Two flavors: "Ready-made" (built-in strategies with plain-language
 * descriptions and tweakable numbers) or "Script" (thinkorswim-style rule
 * text with validate-as-you-type feedback). Guardrails (stop loss, take
 * profit, max hold) apply to both.
 *
 * Controlled: `value` is the StrategyInput shape the backend expects,
 * `onChange(next)` receives the whole updated object.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Chip,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { getBuiltinStrategies, validateBackplayScript } from '../../api/backplay';
import Acronym from '../../components/common/Acronym';

export const DEFAULT_STRATEGY = {
  kind: 'builtin',
  builtin_id: 'breakout',
  params: {},
  entry_script: '',
  exit_script: '',
  stop_loss_pct: 8,
  take_profit_pct: null,
  max_hold_days: null,
};

const SCRIPT_PLACEHOLDER_ENTRY = 'close > Highest(close, 20) and volume > 1.5 * SMA(volume, 50)';
const SCRIPT_PLACEHOLDER_EXIT = 'close < Lowest(close, 10)';

function ScriptField({ label, placeholder, value, onChange, helper }) {
  const [feedback, setFeedback] = useState(null);

  const handleBlur = async () => {
    const script = (value || '').trim();
    if (!script) {
      setFeedback(null);
      return;
    }
    try {
      const result = await validateBackplayScript(script);
      setFeedback(result.valid ? { ok: true } : { ok: false, error: result.error });
    } catch {
      setFeedback(null);
    }
  };

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      onBlur={handleBlur}
      multiline
      minRows={2}
      fullWidth
      size="small"
      error={feedback ? !feedback.ok : false}
      helperText={
        feedback && !feedback.ok
          ? feedback.error
          : feedback?.ok
            ? 'Looks good ✓'
            : helper
      }
      inputProps={{ spellCheck: false, style: { fontFamily: 'monospace', fontSize: 13 } }}
    />
  );
}

function NumberField({ label, value, onChange, suffix, width = 130 }) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === '' ? null : Number(raw));
      }}
      sx={{ width }}
      InputProps={{ endAdornment: suffix ? <Typography variant="caption">{suffix}</Typography> : null }}
    />
  );
}

function StrategyPicker({ value, onChange }) {
  const strategy = value || DEFAULT_STRATEGY;

  const { data: builtinData } = useQuery({
    queryKey: ['backplayBuiltins'],
    queryFn: getBuiltinStrategies,
    staleTime: Infinity,
  });
  const builtins = builtinData?.builtins || [];
  const selectedBuiltin = builtins.find((entry) => entry.id === strategy.builtin_id);

  const update = (patch) => onChange({ ...strategy, ...patch });

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={strategy.kind}
        onChange={(_, kind) => kind && update({ kind })}
      >
        <ToggleButton value="builtin">Ready-made rule</ToggleButton>
        <ToggleButton value="script">Write a script</ToggleButton>
      </ToggleButtonGroup>

      {strategy.kind === 'builtin' ? (
        <Stack spacing={1.5}>
          <TextField
            select
            label="Strategy"
            size="small"
            value={strategy.builtin_id || 'breakout'}
            onChange={(event) => update({ builtin_id: event.target.value, params: {} })}
            sx={{ maxWidth: 320 }}
          >
            {builtins.map((entry) => (
              <MenuItem key={entry.id} value={entry.id}>
                {entry.name}
              </MenuItem>
            ))}
            {builtins.length === 0 && <MenuItem value="breakout">Breakout</MenuItem>}
          </TextField>
          {selectedBuiltin && (
            <Typography variant="body2" color="text.secondary">
              {selectedBuiltin.description}
            </Typography>
          )}
          {selectedBuiltin && Object.keys(selectedBuiltin.defaults || {}).length > 0 && (
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              {Object.entries(selectedBuiltin.defaults).map(([param, fallback]) => (
                <NumberField
                  key={param}
                  label={param.replace(/_/g, ' ')}
                  value={strategy.params?.[param] ?? fallback}
                  onChange={(next) =>
                    update({ params: { ...strategy.params, [param]: next ?? fallback } })
                  }
                  suffix="days"
                  width={150}
                />
              ))}
            </Stack>
          )}
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Rules use daily bars: <code>open, high, low, close, volume</code>, functions{' '}
              <code>SMA, EMA, RSI, ATR, Highest, Lowest</code>, and{' '}
              <code>crosses above / crosses below</code>.
            </Typography>
          </Box>
          <ScriptField
            label={<Acronym term="Entry Rule">When to buy</Acronym>}
            placeholder={SCRIPT_PLACEHOLDER_ENTRY}
            value={strategy.entry_script}
            onChange={(entry_script) => update({ entry_script })}
            helper="Required — the test buys the next day after this is true"
          />
          <ScriptField
            label={<Acronym term="Exit Rule">When to sell</Acronym>}
            placeholder={SCRIPT_PLACEHOLDER_EXIT}
            value={strategy.exit_script}
            onChange={(exit_script) => update({ exit_script })}
            helper="Optional — guardrails below also close trades"
          />
        </Stack>
      )}

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Chip size="small" variant="outlined" label="Guardrails" />
        <NumberField
          label={<Acronym term="Stop Loss">Sell if it drops</Acronym>}
          value={strategy.stop_loss_pct}
          onChange={(stop_loss_pct) => update({ stop_loss_pct })}
          suffix="%"
        />
        <NumberField
          label={<Acronym term="Take Profit">Sell after gaining</Acronym>}
          value={strategy.take_profit_pct}
          onChange={(take_profit_pct) => update({ take_profit_pct })}
          suffix="%"
        />
        <NumberField
          label="Max days held"
          value={strategy.max_hold_days}
          onChange={(max_hold_days) => update({ max_hold_days })}
          suffix="days"
          width={140}
        />
      </Stack>
    </Stack>
  );
}

export default StrategyPicker;
