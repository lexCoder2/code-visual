import type { CSSProperties } from "react";
import { CAMERA_VISUAL } from "../../config/constants";

type MotionControlProps = {
  motionSpeedFactor: number;
  onChangeMotion: (value: number) => void;
};

export function MotionControl(props: MotionControlProps) {
  const { motionSpeedFactor, onChangeMotion } = props;
  const range = CAMERA_VISUAL.maxSpeedFactor - CAMERA_VISUAL.minSpeedFactor;
  const fillPercent =
    range > 0
      ? ((motionSpeedFactor - CAMERA_VISUAL.minSpeedFactor) / range) * 100
      : 0;

  return (
    <label
      className="control-item motion-picker"
      htmlFor="motion-speed"
      style={{ "--motion-fill": `${fillPercent}%` } as CSSProperties}
    >
      Motion
      <input
        className="motion-range"
        id="motion-speed"
        type="range"
        min={CAMERA_VISUAL.minSpeedFactor}
        max={CAMERA_VISUAL.maxSpeedFactor}
        step={0.1}
        value={motionSpeedFactor}
        onChange={(event) => {
          onChangeMotion(Number(event.target.value));
        }}
      />
      <span>{motionSpeedFactor.toFixed(1)}x</span>
    </label>
  );
}
