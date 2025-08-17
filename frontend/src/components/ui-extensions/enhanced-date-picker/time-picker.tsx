"use client";

import * as React from "react";
import { TimePickerInput } from "./time-picker-input";
import { getTimezoneDetails, getShortLocalTimezone } from "@/utils/dates";
import { TimeIcon } from "./time-icon";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
  noSeconds?: boolean;
}

export function TimePicker({
  date,
  setDate,
  className,
  noSeconds,
}: TimePickerProps) {
  const minuteRef = React.useRef<HTMLInputElement>(null);
  const hourRef = React.useRef<HTMLInputElement>(null);
  const secondRef = React.useRef<HTMLInputElement>(null);

  const shortTimezone = React.useMemo(() => getShortLocalTimezone(), []);
  const timezoneDetails = React.useMemo(() => getTimezoneDetails(), []);

  return (
    <div
      className={cn(
        "flex w-full flex-1 items-center gap-1 rounded-b-md border-t-2 bg-transparent px-3 py-2 text-sm ring-offset-background",
        className,
      )}
    >
      <div className="mx-1 grid gap-1 text-center">
        <TimeIcon time={date} />
      </div>
      <div className="grid gap-1 text-center">
        <TimePickerInput
          picker="hours"
          date={date}
          setDate={setDate}
          ref={hourRef}
          onRightFocus={() => minuteRef.current?.focus()}
        />
      </div>
      {":"}
      <div className="grid gap-1 text-center">
        <TimePickerInput
          picker="minutes"
          id="minutes"
          date={date}
          setDate={setDate}
          ref={minuteRef}
          onLeftFocus={() => hourRef.current?.focus()}
          onRightFocus={() => secondRef.current?.focus()}
        />
      </div>
      {!noSeconds && ":"}
      {!noSeconds && (
        <div className="grid gap-1">
          <TimePickerInput
            picker="seconds"
            id="seconds"
            date={date}
            setDate={setDate}
            ref={secondRef}
            onLeftFocus={() => minuteRef.current?.focus()}
          />
        </div>
      )}
      <div className="group relative ml-1 text-muted-foreground">
        <span>{shortTimezone}</span>
        <div className="text-s absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-card px-2 py-1 text-card-foreground shadow-md ring-1 ring-border group-hover:block">
          {timezoneDetails}
        </div>
      </div>
    </div>
  );
}
