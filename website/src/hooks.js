import { useEffect, useState } from "react";
import { registrationStatus } from "./data.js";
export function useRegistrationStatus(championship) {
  const [now, setNow] = useState(__BUILD_TIME__);
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  return registrationStatus(championship, now);
}
