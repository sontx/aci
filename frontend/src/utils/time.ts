import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const USER_TIMEZONE = dayjs.tz.guess();

export function formatToLocalTime(
  date: Date | string,
  format: string = "DD/MM/YYYY HH:mm:ss",
): string {
  return dayjs.utc(date).tz(USER_TIMEZONE).format(format);
}

export function formatToUTCTime(
  date: Date | string,
  format: string = "DD/MM/YYYY HH:mm:ss",
): string {
  return dayjs(date).utc().format(format);
}

export function formatRelativeTime(
  date: Date | string,
  withoutSuffix: boolean = false,
): string {
  return dayjs.utc(date).tz(USER_TIMEZONE).fromNow(withoutSuffix);
}
