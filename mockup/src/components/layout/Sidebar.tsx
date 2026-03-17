import { useState } from 'react';
import { Film, Cog, GitBranch, FolderOpen, FolderPlus, FilePlus, Tag, AlertTriangle, ChevronRight, ChevronDown, Music } from 'lucide-react';
import ValidationPanel from '../panels/ValidationPanel';

interface SidebarProps {
  onFocusNode?: (nodeId: string) => void;
}

type TabId = 'nodes' | 'assets' | 'validation';

export default function Sidebar({ onFocusNode }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('nodes');

  const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
    { id: 'nodes', icon: <Film size={18} />, label: 'Nodes' },
    { id: 'assets', icon: <FolderOpen size={18} />, label: 'Assets' },
    { id: 'validation', icon: <AlertTriangle size={18} />, label: 'Validate' },
  ];

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-[#2e303a] bg-[#14151c]">
      {/* Tab bar */}
      <div className="flex border-b border-[#2e303a]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-xs font-medium transition ${
              activeTab === tab.id
                ? 'text-slate-100 border-b-2 border-blue-500 -mb-px'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {activeTab === 'nodes' && <NodesTab />}
        {activeTab === 'assets' && <AssetsTab />}
        {activeTab === 'validation' && <ValidationPanel onFocusNode={onFocusNode} />}
      </div>
    </div>
  );
}

function NodesTab() {
  const nodeTypes = [
    {
      type: 'scene',
      label: 'Scene Node',
      icon: <Film size={18} className="text-blue-400" />,
      iconBg: 'bg-blue-500/20',
      description: 'Video playback with decisions',
    },
    {
      type: 'state',
      label: 'State Node',
      icon: <Cog size={18} className="text-amber-400" />,
      iconBg: 'bg-amber-500/20',
      description: 'Mutate game state variables',
    },
    {
      type: 'decision',
      label: 'Decision Node',
      icon: <GitBranch size={18} className="text-violet-400" />,
      iconBg: 'bg-violet-500/20',
      description: 'Branch based on conditions',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 uppercase tracking-wider font-medium pb-0.5">
        Drag to canvas
      </div>
      {nodeTypes.map((nt) => (
        <div
          key={nt.type}
          draggable
          className="group flex items-center gap-3 rounded-lg border border-[#2e303a] bg-[#1a1b23] px-3.5 py-3.5 cursor-grab hover:border-slate-600 transition active:cursor-grabbing"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${nt.iconBg}`}>
            {nt.icon}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-200">{nt.label}</div>
            <div className="text-xs text-slate-500">{nt.description}</div>
          </div>
        </div>
      ))}

      {/* Graph legend */}
      <div className="mt-6 pt-5 border-t border-[#2e303a]">
        <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">
          Legend
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-blue-400" />
            <span className="text-slate-400">Scene Node</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="text-slate-400">State Node</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-violet-400" />
            <span className="text-slate-400">Decision Node</span>
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <div className="h-3 w-5 rounded-full border border-emerald-500" />
            <span className="text-slate-400">Root node</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-5 rounded-full border border-red-500" />
            <span className="text-slate-400">End node</span>
          </div>
          <div className="flex items-center gap-2.5">
            <svg width="20" height="12" className="text-slate-500">
              <line x1="0" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,3" />
            </svg>
            <span className="text-slate-400">Cycle (loop back)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AssetFile {
  name: string;
  type: 'video' | 'audio';
  hasAlpha: boolean;
}

interface AssetFolder {
  name: string;
  files: AssetFile[];
  children?: AssetFolder[];
}

function AssetsTab() {
  const tree: AssetFolder[] = [
    {
      name: 'backgrounds',
      files: [
        { name: 'bg_forest_loop.mov', type: 'video', hasAlpha: false },
        { name: 'cave_interior.mov', type: 'video', hasAlpha: false },
        { name: 'river_wide.mov', type: 'video', hasAlpha: false },
        { name: 'mountain_climb.mov', type: 'video', hasAlpha: false },
      ],
      children: [
        {
          name: 'endings',
          files: [
            { name: 'ending_good.mov', type: 'video', hasAlpha: false },
            { name: 'ending_bad.mov', type: 'video', hasAlpha: false },
          ],
        },
      ],
    },
    {
      name: 'overlays',
      files: [
        { name: 'particles_overlay.mov', type: 'video', hasAlpha: true },
        { name: 'torch_flicker.mov', type: 'video', hasAlpha: true },
        { name: 'clouds_overlay.mov', type: 'video', hasAlpha: true },
      ],
    },
    {
      name: 'audio',
      files: [
        { name: 'ambient_forest.wav', type: 'audio', hasAlpha: false },
        { name: 'cave_drip.wav', type: 'audio', hasAlpha: false },
        { name: 'water_flowing.wav', type: 'audio', hasAlpha: false },
        { name: 'narration_intro.wav', type: 'audio', hasAlpha: false },
        { name: 'epic_score.wav', type: 'audio', hasAlpha: false },
        { name: 'victory_theme.wav', type: 'audio', hasAlpha: false },
      ],
    },
  ];

  const tags = ['forest', 'cave', 'ambient', 'narration', 'overlay', 'mountain', 'water'];

  return (
    <div className="space-y-5">
      {/* Action buttons */}
      <div className="flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#2e303a] px-3 py-2.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-[#1a1b23] transition">
          <FolderPlus size={15} />
          New Folder
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#2e303a] px-3 py-2.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-[#1a1b23] transition">
          <FilePlus size={15} />
          Import File
        </button>
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-500">
          <Tag size={14} />
          Tags
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#2e303a] bg-[#1a1b23] px-2.5 py-1 text-xs text-slate-400 cursor-pointer hover:border-slate-500 hover:text-slate-300 transition"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div className="border-t border-[#2e303a] pt-3">
        <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">
          File Tree
        </div>
        <div className="space-y-0.5">
          {tree.map((folder) => (
            <FolderTreeNode key={folder.name} folder={folder} depth={0} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FolderTreeNode({ folder, depth }: { folder: AssetFolder; depth: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#1a1b23] transition group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {expanded ? (
          <ChevronDown size={14} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-slate-500 shrink-0" />
        )}
        <FolderOpen size={15} className="text-amber-400/80 shrink-0" />
        <span className="text-slate-300 truncate font-medium">{folder.name}</span>
        <span className="ml-auto text-xs text-slate-600">{folder.files.length}</span>
      </button>
      {expanded && (
        <div>
          {folder.children?.map((child) => (
            <FolderTreeNode key={child.name} folder={child} depth={depth + 1} />
          ))}
          {folder.files.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#1a1b23] cursor-pointer transition"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              {file.type === 'video' ? (
                <Film size={14} className="text-blue-400 shrink-0" />
              ) : (
                <Music size={14} className="text-green-400 shrink-0" />
              )}
              <span className="text-slate-300 truncate">{file.name}</span>
              {file.hasAlpha && (
                <span className="ml-auto shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  α
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
