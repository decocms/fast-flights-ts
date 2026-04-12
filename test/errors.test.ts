import { describe, it, expect } from "vitest";
import { parseJs, parse } from "../src/parser.js";
import { ParseError } from "../src/errors.js";

describe("parser error handling", () => {
  it("throws ParseError on CAPTCHA page", () => {
    const html = '<html><body><div class="g-recaptcha"></div></body></html>';
    expect(() => parse(html)).toThrow(ParseError);
    expect(() => parse(html)).toThrow("CAPTCHA");
  });

  it("throws ParseError on error response page", () => {
    const html = '<html><script class="ds:1" nonce="x">errorHasStatus: true</script></html>';
    expect(() => parse(html)).toThrow(ParseError);
  });

  it("throws ParseError when ds:1 is missing", () => {
    const html = "<html><body>No flights here</body></html>";
    expect(() => parse(html)).toThrow(ParseError);
    expect(() => parse(html)).toThrow("no script tag");
  });

  it("throws ParseError on malformed JSON", () => {
    expect(() => parseJs("data:{not valid json},end")).toThrow(ParseError);
    expect(() => parseJs("data:{not valid json},end")).toThrow("Failed to parse");
  });

  it("throws ParseError when data: is missing", () => {
    expect(() => parseJs("no data here")).toThrow(ParseError);
    expect(() => parseJs("no data here")).toThrow('"data:"');
  });

  it("returns empty results for null flight list without crashing", () => {
    const payload = [null, null, null, [null], null, null, null, [null, [
      [["*A", "Star Alliance"]],
      [["JL", "Japan Airlines"]],
    ]]];
    const js = `data:${JSON.stringify(payload)},end`;
    const results = parseJs(js);
    expect(results).toHaveLength(0);
    expect(results.metadata).toBeDefined();
  });

  it("returns empty metadata when payload[7] is missing", () => {
    const payload = [null, null, null, [null], null, null, null, null];
    const js = `data:${JSON.stringify(payload)},end`;
    const results = parseJs(js);
    expect(results).toHaveLength(0);
    expect(results.metadata.airlines).toEqual([]);
    expect(results.metadata.alliances).toEqual([]);
  });

  it("skips malformed flight entries without crashing", () => {
    const payload = [null, null, null, [
      [
        // valid flight
        [
          ["Nonstop", ["UA"], [
            [null, null, null, "SFO", "San Francisco", "Tokyo", "NRT",
              null, [10, 0], null, [14, 0], 600,
              null, null, null, null, null, "Boeing 777", null, null,
              [2026, 5, 25], [2026, 5, 26]],
          ],
            null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, null, null,
            [null, null, null, null, null, null, null, 500000, 600000],
          ],
          [[null, 800]],
        ],
        // malformed entry — null
        null,
        // malformed entry — missing nested fields
        [null, null],
      ],
    ], null, null, null, [null, [
      [["*A", "Star Alliance"]],
      [["UA", "United"]],
    ]]];
    const js = `data:${JSON.stringify(payload)},end`;
    const results = parseJs(js);
    // Should get 1 valid flight, skip the 2 broken ones
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].price).toBe(800);
  });
});
