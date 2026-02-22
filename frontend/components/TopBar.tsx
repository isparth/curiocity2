"use client";

interface TopBarProps {
  entityName: string | null;
  onRestart: () => void;
  onRename?: () => void;
  showRestart: boolean;
}

export default function TopBar({ entityName, onRestart, onRename, showRestart }: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex justify-center pt-12 px-4">
      <div className="glass flex items-center gap-3 px-5 py-3 min-h-[48px]">
        {showRestart && (
          <button
            onClick={onRestart}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Restart"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 1 3-6.35" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
        )}
        <span className="text-white/80 text-lg font-nunito font-semibold whitespace-nowrap">
          {entityName ? `Talk to: ${entityName}` : "Talk to..."}
        </span>
        {entityName && onRename && (
          <button
            onClick={onRename}
            className="px-3 py-1 rounded-full text-xs text-teal border border-teal/50 hover:bg-teal/15 transition-colors"
          >
            Wrong name?
          </button>
        )}
      </div>
    </div>
  );
}
