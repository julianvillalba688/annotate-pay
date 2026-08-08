"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_EARNINGS_START_DATE,
  isValidEarningsStartDate,
  persistEarningsStartDate,
  readEarningsStartDate,
} from "@/lib/earnings-start-date";

export function useEarningsStartDate() {
  const [startDate, setStartDateState] = useState(
    DEFAULT_EARNINGS_START_DATE,
  );

  useEffect(() => {
    setStartDateState(readEarningsStartDate());
  }, []);

  function setStartDate(nextDate: string) {
    if (!isValidEarningsStartDate(nextDate)) return;
    setStartDateState(nextDate);
    persistEarningsStartDate(nextDate);
  }

  return { startDate, setStartDate };
}
