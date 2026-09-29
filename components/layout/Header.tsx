import { Bell, Search, User, Keyboard } from 'lucide-react';
import EnvironmentSwitcher from '@/components/features/network/EnvironmentSwitcher';
import { useKeyboardShortcutsStore } from '@/stores/keyboardShortcuts';

function Header() {
  const triggerPalette = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  return (
    <header className="flex items-center justify-between pl-16 pr-6 py-4 md:px-6 bg-white shadow-sm border-b">
      <button
        type="button"
        role="searchbox"
        onClick={triggerPalette}
        className="flex items-center text-left bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 w-64 text-gray-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Search actions (shortcut: Command + K)"
      >
        <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" aria-hidden="true" />
        <span className="text-xs flex-1 text-gray-500">Search commands...</span>
        <span className="hidden sm:flex items-center gap-0.5 text-[9px] font-bold text-gray-400 bg-white border px-1.5 py-0.5 rounded shadow-sm shrink-0">
          <span>&#8984;</span><span>K</span>
        </span>
      </button>

      <div className="flex items-center space-x-3">
        <EnvironmentSwitcher />
        <button
          type="button"
          onClick={() => useKeyboardShortcutsStore.getState().openModal()}
          className="text-gray-500 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none flex items-center gap-1"
          aria-label="Keyboard shortcuts (press ?)"
          title="Keyboard shortcuts (press ?)"
        >
          <Keyboard className="w-5 h-5" aria-hidden="true" />
          <span className="hidden lg:inline text-[10px] font-mono font-semibold bg-gray-100 border border-gray-300 px-1 py-0.5 rounded text-gray-600">
            ?
          </span>
        </button>
        <button
          className="text-gray-600 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:rounded"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
        </button>
        <div
          className="flex items-center space-x-2"
          role="group"
          aria-label="User profile"
        >
          <div
            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <User className="w-5 h-5 text-gray-600" />
          </div>

          <span className="hidden sm:inline text-sm font-medium text-gray-700">Admin</span>
        </div>
      </div>
    </header>
  );
}

export default Header;
