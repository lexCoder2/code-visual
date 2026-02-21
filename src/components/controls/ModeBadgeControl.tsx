type ModeBadgeControlProps = {
  mode: "live" | "mock";
};

export function ModeBadgeControl(props: ModeBadgeControlProps) {
  const { mode } = props;

  return (
    <div className={`control-item mode-badge ${mode}`}>
      {mode === "live" ? "Live Memgraph" : "Mock Mode"}
    </div>
  );
}
