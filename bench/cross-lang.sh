#!/usr/bin/env bash
# Cross-language benchmark: Python (pip install fast-flights) vs TypeScript
# Usage: bash bench/cross-lang.sh [iterations]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ITERS="${1:-10000}"

echo "=== Cross-Language Benchmark: Python vs TypeScript ==="
echo "Iterations: $ITERS"
echo ""

# Check Python fast-flights
if ! python3 -c "from fast_flights.querying import create_query" 2>/dev/null; then
  echo "Python fast-flights not installed (pip install fast-flights)."
  echo "Running TypeScript-only benchmarks..."
  echo ""
  npx tsx "$ROOT_DIR/bench/cli.ts" both "$ITERS"
  exit 0
fi

# Python benchmark (self-contained, suppresses parser debug print)
PY_BENCH=$(cat <<'PYEOF'
import sys, time, json, builtins
from fast_flights.querying import FlightQuery, Passengers, create_query
from fast_flights.parser import parse_js
_print = builtins.print
builtins.print = lambda *a, **kw: None
def out(*a, **kw): _print(*a, **kw)

iters = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
mode = sys.argv[2] if len(sys.argv) > 2 else "both"

def bench_encode(n):
    for _ in range(n):
        q = create_query(
            flights=[FlightQuery(date="2026-02-16", from_airport="MYJ", to_airport="TPE")],
            seat="economy", trip="one-way", passengers=Passengers(adults=1),
        )
        q.to_str()

def build_payload():
    flights = []
    for i in range(20):
        flights.append([
            ["Nonstop", ["Japan Airlines", "ANA"],
             [[None, None, None, "MYJ", "Matsuyama", "Taipei", "TPE",
               None, [10, 30], None, [14, 45], 180,
               None, None, None, None, None, "Boeing 787", None, None,
               [2026, 2, 16], [2026, 2, 16]]],
             None, None, None, None, None, None, None, None, None,
             None, None, None, None, None, None, None, None, None, None,
             [None, None, None, None, None, None, None, 85000, 92000]],
            [[None, 350 + i]]])
    payload = [None, None, None, [flights], None, None, None,
               [None, [[["*A", "Star Alliance"], ["OW", "Oneworld"]],
                        [["JL", "Japan Airlines"], ["NH", "ANA"]]]]]
    return "data:" + json.dumps(payload) + ",sideChannel"

def bench_parse(n):
    js = build_payload()
    for _ in range(n):
        parse_js(js)

if mode in ("encode", "both"):
    t = time.perf_counter()
    bench_encode(iters)
    elapsed = (time.perf_counter() - t) * 1000
    out(f"[Python] encode x{iters}: {elapsed:.2f}ms ({int(iters / elapsed * 1000)} ops/sec)")

if mode in ("parse", "both"):
    t = time.perf_counter()
    bench_parse(iters)
    elapsed = (time.perf_counter() - t) * 1000
    out(f"[Python] parse x{iters}: {elapsed:.2f}ms ({int(iters / elapsed * 1000)} ops/sec)")
PYEOF
)

echo "--- Encoding ---"
echo ""
python3 -c "$PY_BENCH" "$ITERS" encode
npx tsx "$ROOT_DIR/bench/cli.ts" encode "$ITERS"

echo ""
echo "--- Parsing ---"
echo ""
python3 -c "$PY_BENCH" "$ITERS" parse
npx tsx "$ROOT_DIR/bench/cli.ts" parse "$ITERS"
