type SyncBadgeControlProps = {
  syncStatus: "idle" | "syncing" | "error";
  isSyncing: boolean;
  autoRefreshEnabled: boolean;
};

export function SyncBadgeControl(props: SyncBadgeControlProps) {
  const { syncStatus, isSyncing, autoRefreshEnabled } = props;

  if (isSyncing) {
    return <div className={`control-item sync-badge ${syncStatus}`}>Syncing…</div>;
  }

  return (
    <div className={`control-item sync-badge ${syncStatus}`}>
      <span className="sync-label">Auto refresh</span>
      <span className={`sync-value ${autoRefreshEnabled ? "on" : "off"}`}>
        {autoRefreshEnabled ? "On" : "Off"}
      </span>
    </div>
  );
}
