import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  CAMERA_VISUAL,
  MAX_VISIBLE_SIBLINGS,
  NODE_WIDTH_BY_KIND,
} from "./config/constants";
import { CanvasControls } from "./components/controls/CanvasControls";
import { ProjectControl } from "./components/controls/ProjectControl";
import { GraphCanvas } from "./components/GraphCanvas";
import { GraphFooter } from "./components/GraphFooter";
import { useGraphController } from "./hooks/useGraphController";
import { getDepthVisual } from "./lib/graphVisuals";
import { useGraphStore } from "./state/graphStore";
import type { SemanticNodeType } from "./types/graph";
import { computeLayoutFrame } from "./lib/layoutEngine";
import { LogoIcon } from "./assets/LogoIcon";

const NODE_TYPE_FILTERS: SemanticNodeType[] = [
  "function",
  "class",
  "import",
  "export",
  "variable",
];

const STORAGE_KEYS = {
  motionSpeedFactor: "code-visual:motionSpeedFactor",
  connectionDepth: "code-visual:connectionDepth",
  nodeTypeFilters: "code-visual:nodeTypeFilters",
} as const;

function readStoredNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readStoredNodeTypeFilters(): Record<SemanticNodeType, boolean> {
  const fallback: Record<SemanticNodeType, boolean> = {
    function: true,
    class: true,
    import: true,
    export: true,
    variable: true,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.nodeTypeFilters);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<Record<SemanticNodeType, boolean>>;
    return {
      function: parsed.function ?? true,
      class: parsed.class ?? true,
      import: parsed.import ?? true,
      export: parsed.export ?? true,
      variable: parsed.variable ?? true,
    };
  } catch {
    return fallback;
  }
}

function App() {
  const {
    mode,
    projectsQuery,
    graphState,
    selectedNode,
    selectProject,
    expandNode,
    changeSiblingPage,
    increaseDepth,
    decreaseDepth,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    isSyncing,
  } = useGraphController();
  const [motionSpeedFactor, setMotionSpeedFactor] = useState(() =>
    readStoredNumber(STORAGE_KEYS.motionSpeedFactor, 1.6),
  );
  const [nodeTypeFilters, setNodeTypeFilters] = useState(() =>
    readStoredNodeTypeFilters(),
  );
  const [renderFrame, setRenderFrame] = useState(graphState.frame);
  const [activeDraggedNodeId, setActiveDraggedNodeId] = useState<string | null>(
    null,
  );
  const renderFrameRef = useRef(graphState.frame);
  const canvasRef = useRef<HTMLElement | null>(null);
  const cameraAnimationRef = useRef<number | null>(null);
  const layoutAnimationRef = useRef<number | null>(null);
  const draggingRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });
  const nodeDragRef = useRef<{
    active: boolean;
    nodeId: string | null;
    x: number;
    y: number;
    moved: boolean;
  }>({
    active: false,
    nodeId: null,
    x: 0,
    y: 0,
    moved: false,
  });
  const suppressClickRef = useRef<string | null>(null);

  const stopAllDragging = () => {
    draggingRef.current.active = false;
    if (
      nodeDragRef.current.active &&
      nodeDragRef.current.nodeId &&
      nodeDragRef.current.moved
    ) {
      suppressClickRef.current = nodeDragRef.current.nodeId;
    }
    setActiveDraggedNodeId(null);
    nodeDragRef.current = {
      active: false,
      nodeId: null,
      x: 0,
      y: 0,
      moved: false,
    };
  };

  const stopCameraAnimation = () => {
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }
  };

  const stopLayoutAnimation = () => {
    if (layoutAnimationRef.current !== null) {
      cancelAnimationFrame(layoutAnimationRef.current);
      layoutAnimationRef.current = null;
    }
  };

  useEffect(() => {
    const handlePointerRelease = () => {
      stopAllDragging();
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);
    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.motionSpeedFactor,
        String(motionSpeedFactor),
      );
    } catch {
      // ignore storage failures
    }
  }, [motionSpeedFactor]);

  useEffect(() => {
    const storedDepth = Math.round(
      readStoredNumber(
        STORAGE_KEYS.connectionDepth,
        graphState.connectionDepth,
      ),
    );
    if (storedDepth !== graphState.connectionDepth) {
      graphState.setConnectionDepth(storedDepth);
    }
    // run once at init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.connectionDepth,
        String(graphState.connectionDepth),
      );
    } catch {
      // ignore storage failures
    }
  }, [graphState.connectionDepth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.nodeTypeFilters,
        JSON.stringify(nodeTypeFilters),
      );
    } catch {
      // ignore storage failures
    }
  }, [nodeTypeFilters]);

  const filteredLayoutFrame = useMemo(() => {
    const rootNodeId = graphState.focusedNodeId ?? graphState.rootNodeId;
    if (!rootNodeId) return { nodes: [], edges: [] };

    const excludedNodeIds = new Set<string>();

    const excludeSubtree = (nodeId: string) => {
      if (excludedNodeIds.has(nodeId)) return;
      excludedNodeIds.add(nodeId);
      (graphState.childIdsByParent[nodeId] ?? []).forEach((childId) => {
        excludeSubtree(childId);
      });
    };

    Object.values(graphState.nodesById).forEach((node) => {
      const semanticType = node.semanticType;
      if (!semanticType) return;
      if (nodeTypeFilters[semanticType]) return;
      excludeSubtree(node.id);
    });

    const filteredNodesById = Object.entries(graphState.nodesById).reduce<
      typeof graphState.nodesById
    >((acc, [nodeId, node]) => {
      if (!excludedNodeIds.has(nodeId)) {
        acc[nodeId] = node;
      }
      return acc;
    }, {});

    const visibleNodeIds = new Set(Object.keys(filteredNodesById));

    const filteredEdgesById = Object.entries(graphState.edgesById).reduce<
      typeof graphState.edgesById
    >((acc, [edgeId, edge]) => {
      if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
        acc[edgeId] = edge;
      }
      return acc;
    }, {});

    const filteredChildrenByParent = Object.entries(
      graphState.childIdsByParent,
    ).reduce<typeof graphState.childIdsByParent>((acc, [parentId, childIds]) => {
      if (!visibleNodeIds.has(parentId)) return acc;
      acc[parentId] = childIds.filter((childId) => visibleNodeIds.has(childId));
      return acc;
    }, {});

    const filteredManualPositions = Object.entries(
      graphState.manualPositions,
    ).reduce<typeof graphState.manualPositions>((acc, [nodeId, position]) => {
      if (visibleNodeIds.has(nodeId)) {
        acc[nodeId] = position;
      }
      return acc;
    }, {});

    return computeLayoutFrame({
      rootNodeId,
      connectionDepth: graphState.connectionDepth,
      nodesById: filteredNodesById,
      edgesById: filteredEdgesById,
      childIdsByParent: filteredChildrenByParent,
      siblingPageByParent: graphState.siblingPageByParent,
      manualPositions: filteredManualPositions,
    });
  }, [graphState, nodeTypeFilters]);

  const positionById = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    renderFrame.nodes.forEach((node) => {
      map[node.id] = { x: node.x, y: node.y };
    });
    return map;
  }, [renderFrame.nodes]);

  const depthById = useMemo(() => {
    const map: Record<string, number> = {};
    graphState.frame.nodes.forEach((node) => {
      map[node.id] = node.depth;
    });
    return map;
  }, [graphState.frame.nodes]);

  const activeProjectId = graphState.projectId ?? "";
  const selectedNodeId = graphState.selectedNodeId;
  const lastVisitedNodeId = graphState.lastVisitedNodeId;
  const focusedNodeId = graphState.focusedNodeId;
  const connectionChip =
    mode === "mock"
      ? { label: "Mock Data", tone: "mock" as const }
      : graphState.syncStatus === "error"
        ? { label: "Disconnected", tone: "disconnected" as const }
        : { label: "Connected", tone: "connected" as const };

  const loopBridgeNodeById = useMemo(() => {
    const neighborById: Record<string, string[]> = {};
    renderFrame.edges.forEach((edge) => {
      neighborById[edge.source] = neighborById[edge.source] ?? [];
      neighborById[edge.target] = neighborById[edge.target] ?? [];
      neighborById[edge.source].push(edge.target);
      neighborById[edge.target].push(edge.source);
    });

    const result: Record<string, boolean> = {};

    Object.entries(neighborById).forEach(([nodeId, neighbors]) => {
      const nodeDepth = depthById[nodeId] ?? 0;
      const lowerDepthCount = neighbors.filter(
        (neighborId) => (depthById[neighborId] ?? 0) < nodeDepth,
      ).length;
      const sameDepthCount = neighbors.filter(
        (neighborId) => (depthById[neighborId] ?? 0) === nodeDepth,
      ).length;
      const jumpDepthCount = neighbors.filter(
        (neighborId) => Math.abs((depthById[neighborId] ?? 0) - nodeDepth) > 1,
      ).length;

      if (lowerDepthCount > 1 || sameDepthCount > 0 || jumpDepthCount > 0) {
        result[nodeId] = true;
      }
    });

    return result;
  }, [depthById, renderFrame.edges]);

  const adjacencyByNode = useMemo(() => {
    const adjacency: Record<string, string[]> = {};
    renderFrame.edges.forEach((edge) => {
      adjacency[edge.source] = adjacency[edge.source] ?? [];
      adjacency[edge.target] = adjacency[edge.target] ?? [];
      adjacency[edge.source].push(edge.target);
      adjacency[edge.target].push(edge.source);
    });
    return adjacency;
  }, [renderFrame.edges]);

  const collectDragPropagationUpdates = (params: {
    nodeId: string;
    deltaX: number;
    deltaY: number;
    sourcePosition: { x: number; y: number };
    basePositionsById: Record<string, { x: number; y: number }>;
  }): Record<string, { x: number; y: number }> => {
    const { nodeId, deltaX, deltaY, sourcePosition, basePositionsById } =
      params;

    const sourceNode = renderFrame.nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return {};

    const sourceScale = getDepthVisual(sourceNode.depth).scale;
    const sourceCanvasWidth =
      NODE_WIDTH_BY_KIND[sourceNode.kind] *
      sourceScale *
      graphState.viewport.scale;
    const maxCanvasDistancePx = Math.max(32, sourceCanvasWidth * 2);

    const updates: Record<string, { x: number; y: number }> = {};
    const queue: Array<{ id: string; transmission: number }> = [
      { id: nodeId, transmission: 1 },
    ];
    const visited = new Set<string>([nodeId]);
    const minInfluence = 0.006;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const neighbors = adjacencyByNode[current.id] ?? [];
      neighbors.forEach((neighborId) => {
        if (visited.has(neighborId)) return;
        visited.add(neighborId);

        const neighborPosition = basePositionsById[neighborId];
        if (!neighborPosition) return;

        const distX = neighborPosition.x - sourcePosition.x;
        const distY = neighborPosition.y - sourcePosition.y;
        const worldDistance = Math.hypot(distX, distY);
        const canvasDistance = worldDistance * graphState.viewport.scale;
        if (canvasDistance > maxCanvasDistancePx) return;

        const normalizedDistance = Math.min(
          1,
          Math.max(0, canvasDistance / maxCanvasDistancePx),
        );
        const squareFalloff = Math.pow(1 - normalizedDistance, 2);
        const influence = 0.95 * squareFalloff * current.transmission;
        if (influence < minInfluence) return;

        const smoothFactor = 0.88;
        const moveX = deltaX * influence * smoothFactor;
        const moveY = deltaY * influence * smoothFactor;

        updates[neighborId] = {
          x: neighborPosition.x + moveX,
          y: neighborPosition.y + moveY,
        };

        queue.push({
          id: neighborId,
          transmission: current.transmission * 0.78,
        });
      });
    }

    return updates;
  };

  const selectedRelativeNodeById = useMemo(() => {
    const result: Record<string, boolean> = {};
    const selectedId = selectedNodeId;
    if (!selectedId) return result;

    renderFrame.edges.forEach((edge) => {
      if (edge.source === selectedId) {
        result[edge.target] = true;
      }
      if (edge.target === selectedId) {
        result[edge.source] = true;
      }
    });

    return result;
  }, [renderFrame.edges, selectedNodeId]);

  const selectedRelativeEdgeById = useMemo(() => {
    const result: Record<string, boolean> = {};
    const selectedId = selectedNodeId;
    if (!selectedId) return result;

    renderFrame.edges.forEach((edge) => {
      if (edge.source === selectedId || edge.target === selectedId) {
        result[edge.id] = true;
      }
    });

    return result;
  }, [renderFrame.edges, selectedNodeId]);

  useEffect(() => {
    const targetFrame = filteredLayoutFrame;
    const currentFrame = renderFrameRef.current;
    const commitFrame = (frame: typeof targetFrame) => {
      layoutAnimationRef.current = requestAnimationFrame(() => {
        setRenderFrame(frame);
        renderFrameRef.current = frame;
        layoutAnimationRef.current = null;
      });
    };

    if (draggingRef.current.active || nodeDragRef.current.active) {
      stopLayoutAnimation();
      commitFrame(targetFrame);
      return;
    }

    if (targetFrame.nodes.length === 0 || currentFrame.nodes.length === 0) {
      stopLayoutAnimation();
      commitFrame(targetFrame);
      return;
    }

    const currentById = currentFrame.nodes.reduce<
      Record<string, { x: number; y: number }>
    >((acc, node) => {
      acc[node.id] = { x: node.x, y: node.y };
      return acc;
    }, {});

    const shouldAnimate = targetFrame.nodes.some((node) => {
      const current = currentById[node.id];
      if (!current) return false;
      return (
        Math.abs(current.x - node.x) > 0.5 || Math.abs(current.y - node.y) > 0.5
      );
    });

    if (!shouldAnimate) {
      stopLayoutAnimation();
      commitFrame(targetFrame);
      return;
    }

    stopLayoutAnimation();

    const durationMs = 280;
    const start = performance.now();

    const tick = (timestamp: number) => {
      const elapsed = timestamp - start;
      const t = Math.min(1, elapsed / durationMs);
      const k = t;

      const interpolatedNodes = targetFrame.nodes.map((targetNode) => {
        const current = currentById[targetNode.id];
        if (!current) return targetNode;

        return {
          ...targetNode,
          x: current.x + (targetNode.x - current.x) * k,
          y: current.y + (targetNode.y - current.y) * k,
        };
      });

      setRenderFrame({
        nodes: interpolatedNodes,
        edges: targetFrame.edges,
      });
      renderFrameRef.current = {
        nodes: interpolatedNodes,
        edges: targetFrame.edges,
      };

      if (t < 1) {
        layoutAnimationRef.current = requestAnimationFrame(tick);
      } else {
        layoutAnimationRef.current = null;
      }
    };

    layoutAnimationRef.current = requestAnimationFrame(tick);

    return () => {
      stopLayoutAnimation();
    };
  }, [filteredLayoutFrame]);

  useEffect(() => {
    return () => {
      stopLayoutAnimation();
    };
  }, []);

  const selectedNodeTotal = selectedNode
    ? (graphState.childTotalByParent[selectedNode.id] ?? 0)
    : 0;
  const selectedPage = selectedNode
    ? (graphState.siblingPageByParent[selectedNode.id] ?? 0)
    : 0;
  const selectedPageCount = Math.max(
    1,
    Math.ceil(selectedNodeTotal / MAX_VISIBLE_SIBLINGS),
  );

  useEffect(() => {
    const focusId = focusedNodeId;
    if (!focusId) return;

    const focusPosition = positionById[focusId];
    if (!focusPosition || !canvasRef.current) return;
    if (draggingRef.current.active || nodeDragRef.current.active) return;

    stopCameraAnimation();

    const snapshot = useGraphStore.getState();
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = snapshot.viewport.scale;
    const startX = snapshot.viewport.x;
    const startY = snapshot.viewport.y;
    const targetX = rect.width / 2 - focusPosition.x * scale;
    const targetY = rect.height / 2 - focusPosition.y * scale;
    const duration = CAMERA_VISUAL.focusDurationMs * motionSpeedFactor * 0.7;
    const start = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - start;
      const t = Math.min(1, elapsed / duration);
      const k = t;

      useGraphStore.getState().setViewport({
        scale,
        x: startX + (targetX - startX) * k,
        y: startY + (targetY - startY) * k,
      });

      if (t < 1) {
        cameraAnimationRef.current = requestAnimationFrame(animate);
      } else {
        cameraAnimationRef.current = null;
      }
    };

    cameraAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      stopCameraAnimation();
    };
  }, [focusedNodeId, motionSpeedFactor, positionById]);

  return (
    <main className="app-shell theme-neumorph">
      <header className="app-header">
        <div className="app-header-title-wrap">
          <LogoIcon size={26} className="app-header-logo" />
          <h1 className="app-header-title">Code Visual</h1>
          <span className={`app-header-chip ${connectionChip.tone}`}>
            {connectionChip.label}
          </span>
        </div>
        <ProjectControl
          activeProjectId={activeProjectId}
          projects={projectsQuery.data ?? []}
          disabled={projectsQuery.isLoading || projectsQuery.isError}
          onSelectProject={selectProject}
        />
      </header>

      {projectsQuery.isError ? (
        <p className="hint error-text">Failed to load projects.</p>
      ) : null}

      <GraphCanvas
        frame={renderFrame}
        viewport={graphState.viewport}
        selectedNodeId={selectedNodeId}
        lastVisitedNodeId={lastVisitedNodeId}
        depthById={depthById}
        loopBridgeNodeById={loopBridgeNodeById}
        selectedRelativeNodeById={selectedRelativeNodeById}
        selectedRelativeEdgeById={selectedRelativeEdgeById}
        activeDraggedNodeId={activeDraggedNodeId}
        controlsOverlay={
          <CanvasControls
            syncStatus={graphState.syncStatus}
            isSyncing={isSyncing}
            autoRefreshEnabled={autoRefreshEnabled}
            connectionDepth={graphState.connectionDepth}
            motionSpeedFactor={motionSpeedFactor}
            nodeTypeFilters={nodeTypeFilters}
            nodeTypeFilterOrder={NODE_TYPE_FILTERS}
            onToggleAutoRefresh={() => setAutoRefreshEnabled((value) => !value)}
            onDepthUp={increaseDepth}
            onDepthDown={decreaseDepth}
            onChangeMotion={setMotionSpeedFactor}
            onToggleNodeTypeFilter={(type) => {
              setNodeTypeFilters((current) => ({
                ...current,
                [type]: !current[type],
              }));
            }}
          />
        }
        setCanvasRef={(node) => {
          canvasRef.current = node;
        }}
        onCanvasContextMenu={(event) => {
          event.preventDefault();
        }}
        onCanvasWheel={(event) => {
          event.preventDefault();
          graphState.zoom(
            event.deltaY < 0 ? 1 : -1,
            event.clientX,
            event.clientY,
          );
        }}
        onCanvasPointerDown={(event) => {
          if (event.button !== 2) return;
          stopCameraAnimation();
          event.currentTarget.setPointerCapture(event.pointerId);
          draggingRef.current = {
            active: true,
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onCanvasPointerMove={(event) => {
          if (nodeDragRef.current.active && nodeDragRef.current.nodeId) {
            const nodeId = nodeDragRef.current.nodeId;
            const snapshot = useGraphStore.getState();
            const currentPosition =
              snapshot.manualPositions[nodeId] ?? positionById[nodeId];
            if (!currentPosition) return;

            const deltaX =
              (event.clientX - nodeDragRef.current.x) /
              graphState.viewport.scale;
            const deltaY =
              (event.clientY - nodeDragRef.current.y) /
              graphState.viewport.scale;
            nodeDragRef.current.x = event.clientX;
            nodeDragRef.current.y = event.clientY;

            if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
              nodeDragRef.current.moved = true;
            }

            const sourceNextPosition = {
              x: currentPosition.x + deltaX,
              y: currentPosition.y + deltaY,
            };

            const basePositionsById = renderFrame.nodes.reduce<
              Record<string, { x: number; y: number }>
            >((acc, node) => {
              const manualPosition = snapshot.manualPositions[node.id];
              acc[node.id] = manualPosition ?? { x: node.x, y: node.y };
              return acc;
            }, {});

            basePositionsById[nodeId] = sourceNextPosition;

            const neighborUpdates = collectDragPropagationUpdates({
              nodeId,
              deltaX,
              deltaY,
              sourcePosition: sourceNextPosition,
              basePositionsById,
            });

            graphState.setManualPositionsBatch({
              [nodeId]: sourceNextPosition,
              ...neighborUpdates,
            });

            return;
          }

          if (!draggingRef.current.active) return;
          const deltaX = event.clientX - draggingRef.current.x;
          const deltaY = event.clientY - draggingRef.current.y;
          draggingRef.current = {
            active: true,
            x: event.clientX,
            y: event.clientY,
          };
          graphState.pan(deltaX, deltaY);
        }}
        onCanvasPointerUp={stopAllDragging}
        onCanvasPointerCancel={stopAllDragging}
        onCanvasPointerLeave={stopAllDragging}
        onNodePointerDown={(nodeId, event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          stopCameraAnimation();
          event.currentTarget.setPointerCapture(event.pointerId);
          nodeDragRef.current = {
            active: true,
            nodeId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
          };
          setActiveDraggedNodeId(nodeId);
        }}
        onNodePointerUp={(event) => {
          event.stopPropagation();
          stopAllDragging();
        }}
        onNodePointerCancel={(event) => {
          event.stopPropagation();
          stopAllDragging();
        }}
        onNodeClick={(nodeId) => {
          if (suppressClickRef.current === nodeId) {
            suppressClickRef.current = null;
            return;
          }

          graphState.setSelectedNode(nodeId);
        }}
        onNodeDoubleClick={(nodeId) => {
          graphState.setNodeExpanded(nodeId, true);
          expandNode(nodeId);
        }}
      />

      <GraphFooter
        selectedNode={selectedNode}
        selectedNodeTotal={selectedNodeTotal}
        selectedPage={selectedPage}
        selectedPageCount={selectedPageCount}
        isSyncing={isSyncing}
        onChangeSiblingPage={changeSiblingPage}
      />
    </main>
  );
}

export default App;
