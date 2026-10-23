import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicImageUrl, isPrivateAddress, webImageMeta } from "./web-images";

test("loopback, private and link-local addresses are recognised", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "192.168.1.10", "172.20.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(address), false, address);
  }
});

test("only public https image URLs are accepted", async () => {
  await assert.rejects(assertPublicImageUrl("http://example.com/a.jpg"), /https/);
  await assert.rejects(assertPublicImageUrl("https://user:pass@example.com/a.jpg"), /Kullanıcı adı/);
  await assert.rejects(assertPublicImageUrl("https://127.0.0.1/a.jpg"), /genel bir internet adresi|çözümlenemedi/);
  await assert.rejects(assertPublicImageUrl("https://[::1]/a.jpg"), /genel bir internet adresi|çözümlenemedi/);
  await assert.rejects(assertPublicImageUrl("https://localhost/a.jpg"), /genel bir internet adresi|çözümlenemedi/);
  await assert.rejects(assertPublicImageUrl("not a url"), /Geçerli bir görsel adresi/);
});

test("a web image keeps its source address as provenance", () => {
  const meta = webImageMeta("https://example.com/photos/ataturk-portrait.jpg");
  assert.equal(meta.source, "web");
  assert.equal(meta.title, "ataturk-portrait");
  assert.equal(meta.pageUrl, "https://example.com/photos/ataturk-portrait.jpg");
  assert.equal(meta.author, "example.com");
  assert.match(meta.license, /kontrol/);
});
