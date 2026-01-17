import { describe, expect, test } from "bun:test";
import { greet } from "./hello";

describe("greet", () => {
  test("returns Hello, World!", () => {
    expect(greet()).toBe("Hello, World!");
  });
});
