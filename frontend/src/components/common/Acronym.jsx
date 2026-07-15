/**
 * Acronym — shows the spelled-out name plus a one-sentence summary in a
 * semi-transparent bubble after a deliberate hover. Falls back to plain text
 * when the term isn't in the glossary, so it's safe to wrap any label.
 */
import { Box, Tooltip, Typography } from '@mui/material';
import { lookupGlossaryEntry } from '../../utils/glossary';

function Acronym({ term, children, sx }) {
  const text = children ?? term ?? '';
  const lookup = term ?? (typeof children === 'string' ? children : '');
  const entry = lookupGlossaryEntry(lookup);

  if (!entry) return <>{text}</>;

  const bubble = (
    <Box sx={{ maxWidth: 320 }}>
      <Typography variant="subtitle2" component="div" sx={{ fontWeight: 700 }}>
        {entry.name}
      </Typography>
      <Typography variant="body2" component="div">
        {entry.summary}
      </Typography>
      {entry.use && (
        <Typography variant="caption" component="div" sx={{ mt: 0.5, opacity: 0.8 }}>
          {entry.use}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip
      title={bubble}
      arrow
      enterTouchDelay={0}
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
      <Box
        component="span"
        data-glossary-term={lookup}
        sx={{
          borderBottom: '1px dotted',
          borderColor: 'text.disabled',
          cursor: 'help',
          ...sx,
        }}
      >
        {text}
      </Box>
    </Tooltip>
  );
}

export default Acronym;
