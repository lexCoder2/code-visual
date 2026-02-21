import { DepthControl } from "./DepthControl";
import { MotionControl } from "./MotionControl";
import { RefreshToggleControl } from "./RefreshToggleControl";
import { SyncBadgeControl } from "./SyncBadgeControl";
import type { SemanticNodeType } from "../../types/graph";

type CanvasControlsProps = {
  syncStatus: "idle" | "syncing" | "error";
  isSyncing: boolean;
  autoRefreshEnabled: boolean;
  connectionDepth: number;
  motionSpeedFactor: number;
  nodeTypeFilters: Record<SemanticNodeType, boolean>;
  nodeTypeFilterOrder: SemanticNodeType[];
  onToggleAutoRefresh: () => void;
  onDepthUp: () => void;
  onDepthDown: () => void;
  onChangeMotion: (value: number) => void;
  onToggleNodeTypeFilter: (type: SemanticNodeType) => void;
};

export function CanvasControls(props: CanvasControlsProps) {
  const {
    syncStatus,
    isSyncing,
    autoRefreshEnabled,
    connectionDepth,
    motionSpeedFactor,
    nodeTypeFilters,
    nodeTypeFilterOrder,
    onToggleAutoRefresh,
    onDepthUp,
    onDepthDown,
    onChangeMotion,
    onToggleNodeTypeFilter,
  } = props;

  return (
    <div
      className="canvas-controls"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <SyncBadgeControl
        syncStatus={syncStatus}
        isSyncing={isSyncing}
        autoRefreshEnabled={autoRefreshEnabled}
      />
      <RefreshToggleControl
        label="Refresh"
        checked={autoRefreshEnabled}
        onToggle={onToggleAutoRefresh}
      />
      <DepthControl
        connectionDepth={connectionDepth}
        onDepthUp={onDepthUp}
        onDepthDown={onDepthDown}
      />
      <MotionControl
        motionSpeedFactor={motionSpeedFactor}
        onChangeMotion={onChangeMotion}
      />
      <div
        className="node-type-filters canvas-controls-node-types"
        role="group"
        aria-label="Node type visibility"
      >
        {nodeTypeFilterOrder.map((type) => (
          <RefreshToggleControl
            key={type}
            label={type}
            checked={nodeTypeFilters[type]}
            onToggle={() => onToggleNodeTypeFilter(type)}
            wrapperClassName="node-type-switch-wrap"
            switchClassName="node-type-switch"
            labelClassName="node-type-switch-label"
          />
        ))}
      </div>
    </div>
  );
}
