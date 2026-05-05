import type { IsoDate, IsoDateTime } from "@/domain/types";

export function toLocalIsoDate(date: Date = new Date()): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isIsoTimestampOnDate(value: IsoDateTime | undefined, date: IsoDate): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value.startsWith(date);
  }

  return toLocalIsoDate(timestamp) === date;
}

export function getTomorrowIsoDate(date: IsoDate): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  localDate.setDate(localDate.getDate() + 1);

  return toLocalIsoDate(localDate);
}

export function formatReadableDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}
