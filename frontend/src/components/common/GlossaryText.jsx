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
import { findGlossaryMatches } from '../../utils/glossary';

function GlossaryText({ children }) {
  if (typeof children !== 'string' || !children) return children ?? null;

  const parts = [];
  let lastIndex = 0;
  for (const match of findGlossaryMatches(children)) {
    if (match.start > lastIndex) {
      parts.push(<Fragment key={`t-${lastIndex}`}>{children.slice(lastIndex, match.start)}</Fragment>);
    }
    parts.push(<Acronym key={`a-${match.start}`} term={match.term} />);
    lastIndex = match.end;
  }
  if (lastIndex < children.length) {
    parts.push(<Fragment key={`t-${lastIndex}`}>{children.slice(lastIndex)}</Fragment>);
  }
  return <>{parts}</>;
}

export default GlossaryText;
