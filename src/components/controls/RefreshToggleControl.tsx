type RefreshToggleControlProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
  wrapperClassName?: string;
  switchClassName?: string;
  labelClassName?: string;
};

export function RefreshToggleControl(props: RefreshToggleControlProps) {
  const {
    label,
    checked,
    onToggle,
    wrapperClassName,
    switchClassName,
    labelClassName,
  } = props;

  return (
    <div className={`control-item refresh-switch-wrap ${wrapperClassName ?? ""}`}>
      <span className={labelClassName}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        className={`refresh-switch ${checked ? "on" : "off"} ${switchClassName ?? ""}`}
        onClick={onToggle}
      >
        <span className="refresh-switch-thumb" />
      </button>
    </div>
  );
}
