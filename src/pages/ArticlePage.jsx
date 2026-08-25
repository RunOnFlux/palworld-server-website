import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { ChevronRight, ArrowRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { SEO } from '../components/common';
import {
  pagesContent,
  resolveRelated,
  buildPageSchemas,
} from '../config/pagesContent';

/**
 * Generic long-form content / guide page.
 *
 * Renders a page defined in `src/config/pagesContent.js`. The exact same content
 * object is used by `scripts/prerender.mjs` to emit the static crawler fallback,
 * so the client render and the prerendered HTML never drift apart.
 */

/**
 * Turn a block's plain text into text plus inline links.
 *
 * Body copy used to be rendered as a bare string, so the only way a content page could
 * link to another one was a full-width `cta` button. The result was that almost every
 * internal link on the site lived in the identical "Related guides" block at the foot of
 * every page — boilerplate, and worth far less than a link inside a sentence that says
 * what is on the other end.
 *
 * A block declares `links: [{ text, href }]`; the FIRST occurrence of each `text` becomes
 * a link. Phrases that overlap an earlier match are skipped rather than nested, and a
 * phrase that does not appear is a content bug that scripts/prerender.mjs refuses to build
 * — silently rendering nothing is how a link disappears without anyone noticing.
 */
const withLinks = (text, links) => {
  if (!links?.length) return text;
  const hits = links
    .map((l) => ({ ...l, start: text.indexOf(l.text) }))
    .filter((h) => h.start !== -1)
    .sort((a, b) => a.start - b.start);

  const out = [];
  let cursor = 0;
  hits.forEach((h, i) => {
    if (h.start < cursor) return;
    if (h.start > cursor) out.push(text.slice(cursor, h.start));
    out.push(
      <Link key={`${h.href}-${i}`} to={h.href} className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors">
        {h.text}
      </Link>,
    );
    cursor = h.start + h.text.length;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
};

// Render a single content block to styled JSX.
const Block = ({ block }) => {
  switch (block.type) {
    case 'h2':
      return <h2 className="text-2xl sm:text-3xl font-bold text-text mt-10 mb-4">{block.text}</h2>;
    case 'h3':
      return <h3 className="text-xl font-semibold text-text mt-6 mb-3">{block.text}</h3>;
    case 'p':
      return <p className="text-text-secondary leading-relaxed mb-4">{withLinks(block.text, block.links)}</p>;
    case 'ul':
      return (
        <ul className="list-disc pl-6 mb-4 space-y-2 text-text-secondary leading-relaxed marker:text-primary">
          {block.items.map((i, idx) => <li key={idx}>{withLinks(i, block.links)}</li>)}
        </ul>
      );
    case 'ol':
      return (
        <ol className="list-decimal pl-6 mb-4 space-y-2 text-text-secondary leading-relaxed marker:text-primary">
          {block.items.map((i, idx) => <li key={idx}>{withLinks(i, block.links)}</li>)}
        </ol>
      );
    case 'table':
      return (
        <div className="overflow-x-auto mb-6 rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface">
                {block.head.map((h, idx) => (
                  <th key={idx} className="px-4 py-3 font-semibold text-text border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="odd:bg-background even:bg-background-alt">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-text-secondary border-b border-border/50">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'cta':
      return (
        <div className="my-8">
          <Link
            to={block.href}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors"
          >
            {block.text}
          </Link>
        </div>
      );
    default:
      return null;
  }
};

Block.propTypes = { block: PropTypes.object.isRequired };

const ArticlePage = ({ pageKey }) => {
  const navigate = useNavigate();
  const page = pagesContent[pageKey];

  // Content pages have no login modal; send "Get Started" to the homepage pricing.
  const handleLoginClick = useCallback(() => {
    navigate('/#pricing');
  }, [navigate]);

  if (!page) return null;

  const related = (page.related || []).map(resolveRelated).filter(Boolean);
  const schemas = buildPageSchemas(page);

  return (
    <>
      <SEO
        title={page.metaTitle || page.title}
        description={page.description}
        url={page.slug}
        breadcrumbs={page.breadcrumbs}
        schemas={schemas}
      />

      <Header onLoginClick={handleLoginClick} />

      <main className="min-h-screen bg-background pt-32 pb-16">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-text-muted">
              {page.breadcrumbs.map((b, i) => {
                const last = i === page.breadcrumbs.length - 1;
                return (
                  <li key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-4 h-4 text-text-muted/60" />}
                    {last ? (
                      <span className="text-text-secondary">{b.name}</span>
                    ) : (
                      <Link to={b.url} className="hover:text-primary transition-colors">{b.name}</Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text mb-6">{page.h1}</h1>
          {page.lead && <p className="text-lg text-text-secondary leading-relaxed mb-6">{page.lead}</p>}

          {page.body.map((block, i) => <Block key={i} block={block} />)}

          {/* FAQ */}
          {page.faq && page.faq.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-text mb-6">Frequently asked questions</h2>
              <div className="space-y-4">
                {page.faq.map((f, i) => (
                  <div key={i} className="bg-surface border border-border rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-text mb-2">{f.question}</h3>
                    <p className="text-text-secondary leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related guides */}
          {related.length > 0 && (
            <section className="mt-12 pt-8 border-t border-border/40">
              <h2 className="text-xl font-bold text-text mb-4">Related guides</h2>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.key}>
                    <Link
                      to={r.slug}
                      className="inline-flex items-center gap-2 text-primary hover:text-primary-light transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                      {r.anchor}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>

      <Footer />
    </>
  );
};

ArticlePage.propTypes = {
  pageKey: PropTypes.string.isRequired,
};

export default ArticlePage;
