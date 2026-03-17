import { useState, useRef, useEffect } from 'react';
import { Save, Settings, Search, CheckCircle, ChevronDown, FolderOpen, Plus, Clock, Zap } from 'lucide-react';

export default function Header() {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recentProjects = [
    { name: 'Forest Adventure', path: '~/projects/forest-adventure' },
    { name: 'Space Odyssey', path: '~/projects/space-odyssey' },
    { name: 'Mystery Mansion', path: '~/projects/mystery-mansion' },
  ];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#2e303a] bg-[#14151c] px-5">
      {/* Left: project selector */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setProjectMenuOpen(!projectMenuOpen)}
            className="flex items-center gap-2.5 rounded-lg border border-[#2e303a] bg-[#1a1b23] px-3 py-2 hover:border-slate-600 hover:bg-[#252630] transition group"
          >
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-blue-900/40">
              IV
            </div>
            <span className="text-base font-semibold text-slate-100">
              Forest Adventure
            </span>
            <ChevronDown
              size={14}
              className={`text-slate-500 transition-transform ${projectMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Project dropdown */}
          {projectMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-[#2e303a] bg-[#1a1b23] shadow-2xl shadow-black/60 z-50">
              <div className="p-2 border-b border-[#2e303a]">
                <button
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-[#252630] hover:text-slate-100 transition"
                  onClick={() => setProjectMenuOpen(false)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/20">
                    <Plus size={16} className="text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">New Project</div>
                    <div className="text-xs text-slate-500">Create a new project wizard</div>
                  </div>
                </button>
                <button
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-[#252630] hover:text-slate-100 transition"
                  onClick={() => setProjectMenuOpen(false)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/20">
                    <FolderOpen size={16} className="text-amber-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Open Project</div>
                    <div className="text-xs text-slate-500">Open an existing directory</div>
                  </div>
                </button>
              </div>
              <div className="p-2">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 uppercase tracking-wider font-medium">
                  <Clock size={12} />
                  Recent
                </div>
                {recentProjects.map((p) => (
                  <button
                    key={p.name}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[#252630] transition"
                    onClick={() => setProjectMenuOpen(false)}
                  >
                    <div className="h-2 w-2 rounded-full bg-slate-600 shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="text-slate-300 font-medium truncate">{p.name}</div>
                      <div className="text-xs text-slate-600 truncate">{p.path}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#2e303a]" />
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle size={14} />
          Saved
        </span>
      </div>

      {/* Center: search */}
      <div className="flex items-center gap-2.5 rounded-lg border border-[#2e303a] bg-[#1a1b23] px-3.5 py-2 text-sm text-slate-500 w-72 cursor-text hover:border-slate-600 transition">
        <Search size={16} />
        <span>Search nodes...</span>
        <span className="ml-auto text-xs text-slate-600 border border-[#2e303a] rounded px-1.5 py-0.5">
          Ctrl+K
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2 rounded-lg border border-[#2e303a] bg-[#1a1b23] px-3.5 py-2 text-sm text-slate-400 hover:bg-[#252630] hover:text-slate-200 hover:border-slate-500 transition">
          <Settings size={16} />
          Config
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-[#2e303a] bg-[#1a1b23] px-3.5 py-2 text-sm text-slate-400 hover:bg-[#252630] hover:text-slate-200 hover:border-slate-500 transition">
          <Save size={16} />
          Save
        </button>
        <div className="h-5 w-px bg-[#2e303a] mx-1" />
        <button className="flex items-center gap-2.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 active:scale-95 transition-all shadow-md shadow-blue-900/30">
          <Zap size={15} className="shrink-0" />
          Compile
        </button>
      </div>
    </header>
  );
}
