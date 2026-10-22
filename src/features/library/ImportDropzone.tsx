import { Spinner } from '../../components/Spinner';
import type { ImportingState } from './useBookImport';

export function ImportOverlay({ importing }: { importing: ImportingState }) {
  return (
    <div className="import-overlay" role="status" aria-live="polite" data-testid="import-overlay">
      <div className="import-overlay__card">
        <Spinner large />
        <div>
          <p className="label">Importing</p>
          <p className="import-overlay__name" lang="ja">
            {importing.fileName}
          </p>
          <p className="import-overlay__phase">{importing.phase}</p>
        </div>
      </div>
    </div>
  );
}

export function DropOverlay() {
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay__frame">
        <p className="label">Add to library</p>
        <p>Drop EPUB or TXT files to add</p>
      </div>
    </div>
  );
}
