import type { ActivityLevel } from "../types/api";

interface ActivityBadgeProps {
  level: ActivityLevel;
}

export function ActivityBadge({ level }: ActivityBadgeProps) {
  return <span className={`activity-badge activity-${level}`}>{level}</span>;
}
