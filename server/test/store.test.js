import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createStore } from "../store.js";

test("corrupt persisted records fail to open and are not overwritten", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fairhold-store-")), "data.json");
  const corrupt = '{"rentals": [unfinished';
  fs.writeFileSync(file, corrupt);
  assert.throws(() => createStore(file), SyntaxError);
  assert.equal(fs.readFileSync(file, "utf8"), corrupt);
});
