import {
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  EDGE_VISUAL,
  NODE_HEIGHT_BY_KIND,
  NODE_WIDTH_BY_KIND,
} from "../config/constants";
import {
  buildOrganicPath,
  getDepthVisual,
  getEdgeDepthColor,
  pointOnPerimeter,
} from "../lib/graphVisuals";
import type { LayoutFrame } from "../lib/layoutEngine";
import type { ViewportState } from "../types/graph";

type GraphCanvasProps = {
  frame: LayoutFrame;
  viewport: ViewportState;
  selectedNodeId: string | null;
  lastVisitedNodeId: string | null;
  depthById: Record<string, number>;
  loopBridgeNodeById: Record<string, boolean>;
  selectedRelativeNodeById: Record<string, boolean>;
  selectedRelativeEdgeById: Record<string, boolean>;
  activeDraggedNodeId: string | null;
  controlsOverlay?: ReactNode;
  setCanvasRef: (node: HTMLElement | null) => void;
  onCanvasContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onCanvasWheel: (event: ReactWheelEvent<HTMLElement>) => void;
  onCanvasPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onCanvasPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onCanvasPointerUp: () => void;
  onCanvasPointerCancel: () => void;
  onCanvasPointerLeave: () => void;
  onNodePointerDown: (
    nodeId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onNodePointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onNodePointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onNodeClick: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
};

export function GraphCanvas(props: GraphCanvasProps) {
  const {
    frame,
    viewport,
    selectedNodeId,
    lastVisitedNodeId,
    depthById,
    loopBridgeNodeById,
    selectedRelativeNodeById,
    selectedRelativeEdgeById,
    activeDraggedNodeId,
    controlsOverlay,
    setCanvasRef,
    onCanvasContextMenu,
    onCanvasWheel,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onCanvasPointerCancel,
    onCanvasPointerLeave,
    onNodePointerDown,
    onNodePointerUp,
    onNodePointerCancel,
    onNodeClick,
    onNodeDoubleClick,
  } = props;

  const nodeGeometryById = useMemo(
    () =>
      frame.nodes.reduce<
        Record<
          string,
          {
            x: number;
            y: number;
            halfWidth: number;
            halfHeight: number;
            depth: number;
          }
        >
      >((acc, node) => {
        const visual = getDepthVisual(node.depth);
        const width = NODE_WIDTH_BY_KIND[node.kind] * visual.scale;
        const height = NODE_HEIGHT_BY_KIND[node.kind] * visual.scale;

        acc[node.id] = {
          x: node.x,
          y: node.y,
          halfWidth: width / 2,
          halfHeight: height / 2,
          depth: node.depth,
        };

        return acc;
      }, {}),
    [frame.nodes],
  );

  const renderedEdges = useMemo(
    () =>
      frame.edges.map((edge) => {
        const sourceGeometry = nodeGeometryById[edge.source];
        const targetGeometry = nodeGeometryById[edge.target];
        if (!sourceGeometry || !targetGeometry) return null;

        const sourceAnchor = pointOnPerimeter(
          { x: sourceGeometry.x, y: sourceGeometry.y },
          { x: targetGeometry.x, y: targetGeometry.y },
          sourceGeometry.halfWidth,
          sourceGeometry.halfHeight,
        );
        const targetAnchor = pointOnPerimeter(
          { x: targetGeometry.x, y: targetGeometry.y },
          { x: sourceGeometry.x, y: sourceGeometry.y },
          targetGeometry.halfWidth,
          targetGeometry.halfHeight,
        );

        const curve = buildOrganicPath(sourceAnchor, targetAnchor);
        const edgeDepth = Math.max(
          depthById[edge.source] ?? 0,
          depthById[edge.target] ?? 0,
        );
        const edgeOpacity = Math.max(
          EDGE_VISUAL.minOpacity,
          1 - edgeDepth * EDGE_VISUAL.opacityStep,
        );
        const edgeWidth = Math.max(
          0.95,
          EDGE_VISUAL.baseWidth - edgeDepth * EDGE_VISUAL.widthDepthDrop,
        );
        const edgeColor = getEdgeDepthColor(edgeDepth);

        return {
          id: edge.id,
          label: edge.label,
          d: curve.d,
          labelX: curve.labelX,
          labelY: curve.labelY,
          edgeOpacity,
          edgeWidth,
          edgeStroke: edgeColor.stroke,
          edgeGlow: edgeColor.glow,
          isSelectedRelative: Boolean(selectedRelativeEdgeById[edge.id]),
        };
      }),
    [frame.edges, nodeGeometryById, depthById, selectedRelativeEdgeById],
  );

  const getStructuredNodeLabel = (label: string, kind: string) => {
    const normalizedLabel = label.trim();

    if (kind === "file") {
      const slashIndex = Math.max(
        normalizedLabel.lastIndexOf("/"),
        normalizedLabel.lastIndexOf("\\"),
      );
      const tail =
        slashIndex >= 0
          ? normalizedLabel.slice(slashIndex + 1)
          : normalizedLabel;
      const hashIndex = tail.indexOf("#");
      const fileName = hashIndex >= 0 ? tail.slice(0, hashIndex) : tail;
      const anchorSuffix = hashIndex >= 0 ? tail.slice(hashIndex) : "";
      const dotIndex = fileName.lastIndexOf(".");

      if (dotIndex > 0 && dotIndex < fileName.length - 1) {
        return {
          primary: fileName.slice(0, dotIndex),
          extension: fileName.slice(dotIndex + 1),
          secondary: anchorSuffix || undefined,
        };
      }

      return {
        primary: fileName || tail,
        secondary: anchorSuffix || undefined,
      };
    }

    const segments = normalizedLabel.split(":").filter(Boolean);
    const isImportLike =
      normalizedLabel.toLowerCase().startsWith("import:") ||
      normalizedLabel.includes(":") ||
      kind === "service";

    if (!isImportLike || segments.length < 2) {
      return { primary: normalizedLabel };
    }

    const [head, ...tail] = segments;
    return {
      primary: head,
      secondary: tail.join(" › "),
    };
  };

  return (
    <section
      ref={setCanvasRef}
      className="canvas"
      role="application"
      aria-label="Project architecture graph"
      onContextMenu={onCanvasContextMenu}
      onWheel={onCanvasWheel}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onPointerCancel={onCanvasPointerCancel}
      onPointerLeave={onCanvasPointerLeave}
    >
      {controlsOverlay ? (
        <div className="canvas-controls-wrap">{controlsOverlay}</div>
      ) : null}
      <div
        className="graph-layer"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        <svg className="edges">
          {renderedEdges.map((edge) => {
            if (!edge) return null;
            return (
              <g key={edge.id}>
                <path
                  d={edge.d}
                  className="edge-line-glow"
                  style={{
                    opacity: edge.isSelectedRelative
                      ? edge.edgeOpacity * 0.42
                      : edge.edgeOpacity * 0.2,
                    strokeWidth: edge.isSelectedRelative
                      ? edge.edgeWidth + 2.6
                      : edge.edgeWidth + 1.7,
                    stroke: edge.edgeGlow,
                  }}
                />
                <path
                  d={edge.d}
                  className={`edge-line ${edge.isSelectedRelative ? "relative" : ""}`}
                  style={{
                    opacity: edge.isSelectedRelative
                      ? Math.min(1, edge.edgeOpacity + 0.2)
                      : edge.edgeOpacity * 0.78,
                    strokeWidth: edge.isSelectedRelative
                      ? edge.edgeWidth + 0.5
                      : edge.edgeWidth,
                    stroke: edge.edgeStroke,
                  }}
                />
                {edge.label ? (
                  <text x={edge.labelX} y={edge.labelY} className="edge-label">
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {frame.nodes.map((node) => {
          const width = NODE_WIDTH_BY_KIND[node.kind];
          const height = NODE_HEIGHT_BY_KIND[node.kind];
          const visual = getDepthVisual(node.depth);
          const structuredLabel = getStructuredNodeLabel(node.label, node.kind);

          return (
            <button
              key={node.id}
              type="button"
              className={`node ${node.kind} ${node.id === selectedNodeId ? "active" : ""} ${node.id === lastVisitedNodeId ? "visited" : ""} ${loopBridgeNodeById[node.id] ? "loop-bridge" : ""} ${selectedRelativeNodeById[node.id] ? "relative" : ""} ${activeDraggedNodeId === node.id ? "dragging" : ""} ${node.depth >= 3 ? "far" : ""}`}
              style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(${node.x - width / 2}px, ${node.y - height / 2}px) scale(${visual.scale})`,
                opacity: visual.opacity,
                zIndex: Math.max(1, 12 - node.depth),
                transformOrigin: "center center",
              }}
              onPointerDown={(event) => onNodePointerDown(node.id, event)}
              onPointerUp={onNodePointerUp}
              onPointerCancel={onNodePointerCancel}
              onClick={() => onNodeClick(node.id)}
              onDoubleClick={() => onNodeDoubleClick(node.id)}
            >
              <span className="node-label-row">
                <span className="node-label-main">
                  {structuredLabel.primary}
                </span>
                {structuredLabel.extension ? (
                  <span className="node-label-ext">
                    .{structuredLabel.extension}
                  </span>
                ) : null}
              </span>
              {structuredLabel.secondary ? (
                <span className="node-label-sub">
                  {structuredLabel.secondary}
                </span>
              ) : null}
              {node.loading ? <small>Loading…</small> : null}
              {node.error ? (
                <small className="error">{node.error}</small>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
