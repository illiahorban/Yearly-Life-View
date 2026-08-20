import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function detectMobileViewport() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent;
  const touchMac =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;
  const mobileUserAgent =
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent,
    );
  return window.innerWidth < MOBILE_BREAKPOINT || mobileUserAgent || touchMac;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(detectMobileViewport);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(detectMobileViewport());
    };
    mql.addEventListener("change", onChange);
    setIsMobile(detectMobileViewport());
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
