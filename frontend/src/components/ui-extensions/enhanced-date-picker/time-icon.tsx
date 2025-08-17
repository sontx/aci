import * as React from "react";
import { Clock, Moon, Sun } from "lucide-react";

const isNoon = (date: Date) =>
  date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0;

const isMidnight = (date: Date) =>
  date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;

export const TimeIcon: React.FC<{ time: Date | undefined }> = ({ time }) => {
  if (time instanceof Date) {
    if (isNoon(time)) return <Sun className="size-5 text-muted-foreground" />;
    if (isMidnight(time)) return <Moon className="size-5 text-muted-foreground" />;
    return <Clock className="size-5 text-muted-foreground" />;
  }

  return <Clock className="size-5 text-muted-foreground" />;
};
