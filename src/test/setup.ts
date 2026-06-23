import "@testing-library/jest-dom/vitest";

// JSDOM lacks a localStorage reset between tests; clear in beforeEach
import { beforeEach } from "vitest";
beforeEach(() => {
  localStorage.clear();
});
