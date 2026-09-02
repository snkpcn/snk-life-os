"use client";

export function TradingViewChart({ symbol, height = 420 }: { symbol: string; height?: number }) {
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tvchart&symbol=${encodeURIComponent(
    symbol
  )}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=0d1a13&studies=[]&theme=dark&style=1&timezone=Asia%2FBangkok&withdateranges=1&hidevolume=0`;
  return (
    <iframe
      title={`TradingView ${symbol}`}
      src={src}
      style={{ width: "100%", height }}
      className="rounded-xl border border-line"
      frameBorder={0}
      allowTransparency
      scrolling="no"
    />
  );
}
