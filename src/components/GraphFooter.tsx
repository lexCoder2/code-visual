import { MAX_VISIBLE_SIBLINGS } from "../config/constants";
import type { GraphNodeEntity } from "../types/graph";

type GraphFooterProps = {
  selectedNode?: GraphNodeEntity;
  selectedNodeTotal: number;
  selectedPage: number;
  selectedPageCount: number;
  isSyncing: boolean;
  onChangeSiblingPage: (parentId: string, nextPage: number) => void;
};

export function GraphFooter(props: GraphFooterProps) {
  const {
    selectedNode,
    selectedNodeTotal,
    selectedPage,
    selectedPageCount,
    isSyncing,
    onChangeSiblingPage,
  } = props;

  if (!selectedNode) {
    return (
      <footer className="hint">
        Select and expand a node to navigate the graph.
      </footer>
    );
  }

  return (
    <footer className="controls-panel">
      <strong>{selectedNode.label}</strong>
      <span>
        Connections: {selectedNodeTotal} · showing{" "}
        {(selectedPage + 1 - 1) * MAX_VISIBLE_SIBLINGS + 1}–
        {Math.min(
          (selectedPage + 1) * MAX_VISIBLE_SIBLINGS,
          selectedNodeTotal || MAX_VISIBLE_SIBLINGS,
        )}
      </span>

      {selectedNodeTotal > MAX_VISIBLE_SIBLINGS ? (
        <div className="pager-controls">
          <button
            type="button"
            onClick={() =>
              onChangeSiblingPage(selectedNode.id, selectedPage - 1)
            }
            disabled={selectedPage <= 0 || isSyncing}
          >
            Prev
          </button>
          <span>
            Page {selectedPage + 1} / {selectedPageCount}
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeSiblingPage(selectedNode.id, selectedPage + 1)
            }
            disabled={selectedPage + 1 >= selectedPageCount || isSyncing}
          >
            Next
          </button>
        </div>
      ) : null}
    </footer>
  );
}
