import { Icon } from '../../components/Icon';

interface EmptyStateProps {
  onAdd: () => void;
  onSample: () => void;
  sampleLoading: boolean;
}

export function EmptyState({ onAdd, onSample, sampleLoading }: EmptyStateProps) {
  return (
    <section className="empty-state" data-testid="empty-state" aria-labelledby="empty-title">
      <div className="empty-state__glyph" lang="ja" aria-hidden="true">
        本
      </div>
      <p className="label">Your shelf</p>
      <h2 id="empty-title">Your shelf is empty.</h2>
      <p className="empty-state__copy">
        Bring an EPUB onto this device. It stays here, in your browser, and works offline once
        opened.
      </p>
      <div className="empty-state__actions">
        <button type="button" className="button" onClick={onAdd}>
          <Icon name="plus" size={18} /> Add your first EPUB
        </button>
        <button
          type="button"
          className="button--text"
          data-testid="sample-button"
          disabled={sampleLoading}
          onClick={onSample}
        >
          {sampleLoading ? 'Adding sample…' : 'Read the sample — 吾輩は猫である（抄）'}
        </button>
      </div>
      <p className="empty-state__tagline" lang="ja">
        日本語を、ゆっくり。
      </p>
    </section>
  );
}
