import {
  MAX_CONNECTION_DEPTH,
  MIN_CONNECTION_DEPTH,
} from "../../config/constants";

type DepthControlProps = {
  connectionDepth: number;
  onDepthUp: () => void;
  onDepthDown: () => void;
};

export function DepthControl(props: DepthControlProps) {
  const { connectionDepth, onDepthUp, onDepthDown } = props;

  return (
    <div
      className="control-item depth-controls"
      aria-label="Graph depth controls"
    >
      <button
        type="button"
        onClick={onDepthDown}
        disabled={connectionDepth <= MIN_CONNECTION_DEPTH}
      >
        ↓
      </button>
      <span>Depth {connectionDepth}</span>
      <button
        type="button"
        onClick={onDepthUp}
        disabled={connectionDepth >= MAX_CONNECTION_DEPTH}
      >
        ↑
      </button>
    </div>
  );
}
