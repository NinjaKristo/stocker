/**
 * GlossaryText — wrap a string and any known trading acronym inside it gets a
 * hover definition automatically (painless: no per-term markup).
 *
 *   <GlossaryText>Strong RS with an EPS beat and a VCP setup</GlossaryText>
 *
 * Whole-word, case-sensitive matches only (so "MA" matches but "format" doesn't),
 * and only the curated AUTO_TERMS — plain words are never touched.
 */
import { Fragment } from 'react';
import Acronym from './Acronym';
import { AUTO_TERMS } from '../../utils/glossary';

const escaped = AUTO_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const TERM_RE = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');

function GlossaryText({ children }) {
  if (typeof children !== 'string' || !children) return children ?? null;

  const parts = [];
  let lastIndex = 0;
  let match;
  TERM_RE.lastIndex = 0;
  while ((match = TERM_RE.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={`t-${lastIndex}`}>{children.slice(lastIndex, match.index)}</Fragment>);
    }
    parts.push(<Acronym key={`a-${match.index}`} term={match[0]} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < children.length) {
    parts.push(<Fragment key={`t-${lastIndex}`}>{children.slice(lastIndex)}</Fragment>);
  }
  return <>{parts}</>;
}

export default GlossaryText;
