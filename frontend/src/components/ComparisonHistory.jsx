import { ArrowRight } from 'lucide-react';
import { Badge, Button, GlassPanel, SectionHeader } from './ui.jsx';
import { formatDay, hostOf } from '../helpers.js';

// Older comparisons of the same baseline. Each one is a saved report: opening it recomputes nothing.
function ComparisonHistory({ comparisons, loadingId, error, onView }) {
  return (
    <section className="history">
      <SectionHeader title="Comparison history" note={`${comparisons.length} earlier · the latest is shown above`} />
      {error && <p className="banner banner-error" role="alert">{error}</p>}

      <GlassPanel as="ol" className="hist-list">
        <li className="hist-row hist-head" aria-hidden="true">
          <span>Date</span><span>Deployment</span><span>Pages</span><span>Status</span><span />
        </li>
        {comparisons.map((comparison) => (
          <li key={comparison.id} className="hist-row">
            <span className="hist-date">{formatDay(comparison.analyzed_at)}</span>
            <span className="hist-url mono" title={comparison.current_url}>{hostOf(comparison.current_url)}</span>
            <span className="hist-pages">{comparison.pages_tested} pages · {comparison.pages_changed} changed</span>
            <span><Badge tone="done">Completed</Badge></span>
            <span className="hist-action">
              <Button size="sm" variant="ghost" onClick={() => onView(comparison.id)} loading={loadingId === comparison.id} disabled={loadingId !== null}>
                View report <ArrowRight size={14} aria-hidden="true" />
              </Button>
            </span>
          </li>
        ))}
      </GlassPanel>
    </section>
  );
}

export default ComparisonHistory;
