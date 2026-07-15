import { useEffect } from 'react';

import { findGlossaryMatches } from '../../utils/glossary';

const SKIP_SELECTOR = 'script, style, textarea, [data-glossary-term]';

function directText(element) {
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.nodeValue || '')
    .join(' ');
}

function definitionTitle(matches) {
  const unique = new Map();
  for (const match of matches) unique.set(match.term.toUpperCase(), match);
  return [...unique.values()]
    .map(({ term, entry }) => `${term}: ${entry.name} - ${entry.summary}`)
    .join('\n\n');
}

/**
 * Adds native hover definitions to known terms that were rendered without the
 * explicit Acronym component. Attribute-only annotation is safe for React and
 * also covers dynamic table cells, SVG chart labels, and third-party widgets.
 */
function AutomaticGlossaryCoverage() {
  useEffect(() => {
    const annotated = new Map();

    const restore = (element) => {
      const originalTitle = annotated.get(element);
      if (originalTitle === undefined) return;
      if (originalTitle === null) element.removeAttribute('title');
      else element.setAttribute('title', originalTitle);
      element.removeAttribute('data-auto-glossary');
      annotated.delete(element);
    };

    const annotate = (element) => {
      if (!(element instanceof Element)) return;
      if (element.matches(SKIP_SELECTOR) || element.closest('[data-glossary-term]')) {
        restore(element);
        return;
      }
      const matches = findGlossaryMatches(directText(element));
      if (!matches.length) {
        restore(element);
        return;
      }
      if (!annotated.has(element)) annotated.set(element, element.getAttribute('title'));
      const originalTitle = annotated.get(element);
      const glossaryTitle = definitionTitle(matches);
      element.setAttribute('title', originalTitle ? `${originalTitle}\n\n${glossaryTitle}` : glossaryTitle);
      element.setAttribute('data-auto-glossary', matches.map((match) => match.term).join(','));
    };

    const scan = (root) => {
      if (root.nodeType === Node.TEXT_NODE) {
        annotate(root.parentElement);
        return;
      }
      if (!(root instanceof Element) || root.matches(SKIP_SELECTOR)) return;
      annotate(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        annotate(node.parentElement);
        node = walker.nextNode();
      }
    };

    scan(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') scan(mutation.target);
        else {
          annotate(mutation.target);
          mutation.addedNodes.forEach(scan);
        }
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });

    return () => {
      observer.disconnect();
      [...annotated.keys()].forEach(restore);
    };
  }, []);

  return null;
}

export default AutomaticGlossaryCoverage;
