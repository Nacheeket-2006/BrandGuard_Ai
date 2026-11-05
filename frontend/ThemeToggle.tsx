import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/** A local preference; never part of the draft or server-side review state. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#000000' : '#f1efe7');
    try {
      localStorage.setItem('brandguard-theme', theme);
    } catch {
      /* Theme still works when browser storage is restricted. */
    }
  }, [theme]);
  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        aria-label="Light mode"
        aria-pressed={theme === 'light'}
        title="Warm paper · Light mode"
        onClick={() => setTheme('light')}
      >
        <Sun size={14} />
        <span>Light</span>
      </button>
      <button
        type="button"
        aria-label="Dark mode"
        aria-pressed={theme === 'dark'}
        title="OLED black · Dark mode"
        onClick={() => setTheme('dark')}
      >
        <Moon size={14} />
        <span>Dark</span>
      </button>
    </div>
  );
}
