import { Icon } from '../../components/Icon';
import { useI18n } from '../../lib/i18n/useI18n';
import { navigateToLibrary } from '../../lib/router';

const image = (name: string): string => `${import.meta.env.BASE_URL}guide/${name}`;

function jumpTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function GuideFigure({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="guide-figure">
      <img src={src} alt="" loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function GuidePage() {
  const { t } = useI18n();

  return (
    <div className="guide-page" data-testid="guide-page">
      <header className="guide-page__header">
        <button
          type="button"
          className="icon-button"
          aria-label={t('Back to library')}
          onClick={navigateToLibrary}
        >
          <Icon name="arrow-left" />
        </button>
        <div className="guide-page__heading">
          <span className="label">JEPUB</span>
          <h1 className="guide-page__title">{t('Guide')}</h1>
        </div>
      </header>

      <main className="guide-page__body">
        <p className="guide-intro">
          {t('A quick tour of JEPUB, from your first import to an AI-generated quiz.')}
        </p>

        <nav className="guide-toc" aria-label={t('On this page')} data-testid="guide-toc">
          <span className="label">{t('On this page')}</span>
          <div className="guide-toc__links">
            {[
              ['guide-shelf', 'Your shelf'],
              ['guide-add', 'Add books'],
              ['guide-find', 'Find a book'],
              ['guide-read', 'Read Japanese'],
              ['guide-sentence', 'Sentence panel'],
              ['guide-ai', 'Set up AI'],
              ['guide-chat', 'AI Chat'],
              ['guide-mypedia', 'MyPedia'],
              ['guide-quiz', 'Quiz'],
              ['guide-privacy', 'Offline and privacy'],
              ['guide-help', 'Troubleshooting'],
            ].map(([id, title]) => (
              <button
                type="button"
                className="guide-toc__link"
                key={id}
                onClick={() => jumpTo(id ?? '')}
              >
                {t(title as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </nav>

        <section className="guide-section" id="guide-shelf">
          <h2>{t('Your shelf')}</h2>
          <p>
            {t('Your shelf is stored on this device. Open the menu for Add book, AI Chat, MyPedia, Quiz, Settings, and this Guide.')}
          </p>
          <p>
            {t('Start with the sample book or add your own EPUB, MOBI, TXT, or Aozora Bunko work.')}
          </p>
          <GuideFigure src={image('library.png')} caption={t('The library and the app menu.')} />
        </section>

        <section className="guide-section" id="guide-add">
          <h2>{t('Add books')}</h2>
          <p>
            {t('Add book is the first item in the menu. Choose a file or paste an Aozora card URL; imported books stay on this device.')}
          </p>
          <GuideFigure src={image('menu.png')} caption={t('The app menu.')} />
        </section>

        <section className="guide-section" id="guide-find">
          <h2>{t('Find a book')}</h2>
          <p>
            {t('Open Filters in the library to search by title or author, then narrow by author, source, or reading status.')}
          </p>
        </section>

        <section className="guide-section" id="guide-read">
          <h2>{t('Read Japanese')}</h2>
          <p>
            {t('Open a book from the shelf. The toolbar gives you read-aloud, sharing, contents, and reader settings.')}
          </p>
          <p>
            {t('Reader settings control horizontal or vertical text, text size, and Katakana, Hiragana, or Romaji readings above kanji.')}
          </p>
          <GuideFigure src={image('reader.png')} caption={t('The reader with vertical Japanese.')} />
        </section>

        <section className="guide-section" id="guide-sentence">
          <h2>{t('Sentence panel')}</h2>
          <p>
            {t('Tap any sentence for ruby, romaji, translation, playback, and a + MyPedia shortcut.')}
          </p>
          <GuideFigure src={image('sentence.png')} caption={t('Sentence details with translation and Ask AI.')} />
        </section>

        <section className="guide-section" id="guide-ai">
          <h2>{t('Set up AI')}</h2>
          <p>
            {t('AI is optional. Choose Off, BYOT, or Local. BYOT uses your own provider key; Local runs entirely on this device.')}
          </p>
          <p>
            {t('Use the ? beside API key for provider-specific steps and official links. Test AI checks the connection before you rely on it.')}
          </p>
          <GuideFigure src={image('ai-settings.png')} caption={t('BYOT settings with Test AI.')} />
          <GuideFigure src={image('ai-key-help.png')} caption={t('Provider-specific API key help.')} />
        </section>

        <section className="guide-section" id="guide-chat">
          <h2>{t('AI Chat')}</h2>
          <p>
            {t('AI Chat keeps conversations on this device. If AI is Off, the menu still opens AI Chat with a shortcut to AI settings.')}
          </p>
          <GuideFigure src={image('ai-chat.png')} caption={t('AI Chat keeps a local history.')} />
        </section>

        <section className="guide-section" id="guide-mypedia">
          <h2>{t('MyPedia')}</h2>
          <p>
            {t('Every AI exchange is summarized before it enters MyPedia. Save checked translations there too, and delete records you no longer need.')}
          </p>
          <GuideFigure src={image('mypedia.png')} caption={t('MyPedia stores summarized learning points.')} />
        </section>

        <section className="guide-section" id="guide-quiz">
          <h2>{t('Quiz')}</h2>
          <p>
            {t('Quiz picks a random MyPedia record and asks AI for four choices in your interface language. Answer, read the explanation, then choose Next question.')}
          </p>
          <p>{t('Quiz is unavailable when AI is Off because it needs an AI service.')}</p>
          <GuideFigure src={image('quiz.png')} caption={t('Quiz with four choices and a result.')} />
        </section>

        <section className="guide-section" id="guide-privacy">
          <h2>{t('Offline and privacy')}</h2>
          <p>
            {t('Books, chats, MyPedia, settings, and local models stay in this browser. No account or JEPUB server is involved.')}
          </p>
        </section>

        <section className="guide-section" id="guide-help">
          <h2>{t('Troubleshooting')}</h2>
          <p>
            {t('No Local option? Your device may not meet the WebGPU memory gate. BYOT still works with a connection.')}
          </p>
          <p>{t('BYOT offline? It needs a connection until you have a local model and Local mode available.')}</p>
          <p>
            {t('API key or model error? Use the ? help, then Test AI. Model catalogs change; choose Custom model ID when needed.')}
          </p>
        </section>
      </main>
    </div>
  );
}
