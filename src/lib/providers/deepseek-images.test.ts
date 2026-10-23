import assert from "node:assert/strict";
import test from "node:test";
import { extractImageUrls } from "./deepseek";

test("DeepSeek web content yields https image URLs only, deduplicated", () => {
  const content = "Portre: ![kişi](https://cdn.example.com/a.jpg) ve eski http://old.example.com/b.png ve https://x.test/c.webp?w=800.";
  assert.deepEqual(extractImageUrls([content]), ["https://cdn.example.com/a.jpg", "https://x.test/c.webp?w=800"]);
  assert.equal(extractImageUrls(["https://a.test/x.png https://a.test/x.png"]).length, 1);
  assert.equal(extractImageUrls([null, undefined, ""]).length, 0);
  assert.equal(extractImageUrls(["https://one.test/1.jpg https://two.test/2.png https://three.test/3.jpg"], 2).length, 2);
});
