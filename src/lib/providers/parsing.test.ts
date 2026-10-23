import assert from "node:assert/strict";
import test from "node:test";
import { parseCharacterResearch, parseEnhancedCharacter, parseEnhancedRepair, parseEnhancedShots } from "./deepseek";
import { outcomeUrl } from "./gmi";
import { parseSheetVerdict } from "./nvidia";
import { expandQueryVariants, parseCommons } from "./wikimedia";
import { parseOpenverse } from "./openverse";

test("Commons results carry plain-text author and licence and skip non-photos", () => {
  const results = parseCommons({ query: { pages: {
    "2": { title: "File:B.png", index: 2, imageinfo: [{ mime: "image/png", width: 800, height: 600, descriptionurl: "https://commons.wikimedia.org/wiki/File:B.png", thumburl: "https://upload.wikimedia.org/b.png", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" }, Artist: { value: "<a href=\"//x\">Ayşe &amp; Ali</a>" } } }] },
    "1": { title: "File:A.jpg", index: 1, imageinfo: [{ mime: "image/jpeg", descriptionurl: "https://commons.wikimedia.org/wiki/File:A.jpg", thumburl: "https://upload.wikimedia.org/a.jpg", extmetadata: {} }] },
    "3": { title: "File:C.svg", index: 3, imageinfo: [{ mime: "image/svg+xml", descriptionurl: "x", thumburl: "y" }] },
  } } });
  assert.deepEqual(results.map((result) => result.title), ["File:A.jpg", "File:B.png"]);
  assert.equal(results[1].author, "Ayşe & Ali");
  assert.equal(results[1].license, "CC BY-SA 4.0");
  assert.equal(results[0].license, "Lisans belirtilmemiş");
});

test("query variants strip parentheses, diacritics and comma order so Commons search is not exact-only", () => {
  const variants = expandQueryVariants("Cevher Dudayev (Anıt Dağ)");
  assert.ok(variants.includes("Cevher Dudayev"));
  assert.ok(variants.some((item) => item === "Cevher Dudayev" || item.toLocaleLowerCase("tr") === "cevher dudayev"));
  assert.ok(expandQueryVariants("Dudayev, Dzhokhar").includes("Dzhokhar Dudayev"));
  assert.ok(expandQueryVariants("Şeyh Şamil").some((item) => !/[şŞ]/.test(item)));
  assert.ok(expandQueryVariants("Aslan Mashadov").length >= 1);
});

test("Openverse results map to the shared result shape and skip dead entries", () => {
  const results = parseOpenverse({ results: [
    { id: "ov1", title: "Portrait", url: "https://live.openverse.test/a.jpg", thumbnail: "https://live.openverse.test/t.jpg", foreign_landing_url: "https://example.test/p", width: 800, height: 600, license: "by", license_url: "https://creativecommons.org/licenses/by/4.0/", creator: "Ayşe" },
    { id: "ov2", title: "Dead", url: "", thumbnail: "", foreign_landing_url: "https://example.test/d", license: "by", creator: "X" },
  ] });
  assert.equal(results.length, 1);
  assert.equal(results[0].source, "openverse");
  assert.equal(results[0].id, "ov1");
  assert.equal(results[0].license, "BY");
});

test("the sheet judge passes only when every score is at least 3 and the average at least 3.5", () => {
  assert.equal(parseSheetVerdict('{"stil":4,"ozellikler":4,"poz":3,"temizlik":4,"not":"iyi"}').ok, true);
  assert.equal(parseSheetVerdict('{"stil":5,"ozellikler":2,"poz":5,"temizlik":5,"not":"bıyık yok"}').ok, false);
  assert.equal(parseSheetVerdict('{"stil":3,"ozellikler":3,"poz":3,"temizlik":4}').ok, false);
  assert.deepEqual(parseSheetVerdict('Sonuç: {"stil":"9","ozellikler":0,"poz":4,"temizlik":4}').scores, { style: 5, traits: 1, pose: 4, clean: 4 });
});

test("GMI outcomes yield the media link for both video and image models", () => {
  assert.equal(outcomeUrl({ video_url: "https://s/v.mp4" }), "https://s/v.mp4");
  assert.equal(outcomeUrl({ media_urls: [{ id: "0", url: "https://s/i.png" }] }), "https://s/i.png");
  assert.equal(outcomeUrl({ media_urls: [{ url: "http://insecure/i.png" }] }), null);
});

test("DeepSeek character research parser normalizes traits, aliases and Commons queries", () => {
  const parsed = parseCharacterResearch(
    '```json\n{"summary":"Deniz feneri bekçisi.","appearance":"grey beard, navy wool coat, brass lantern","aliases":["Bekçi","İhtiyar"],"commonsQueries":["Lighthouse keeper portrait","Old sailor beard"]}\n```',
    "Fotoğrafçı",
  );
  assert.equal(parsed.summary, "Deniz feneri bekçisi.");
  assert.equal(parsed.appearance, "grey beard, navy wool coat, brass lantern");
  assert.deepEqual(parsed.aliases, ["Bekçi", "İhtiyar"]);
  assert.deepEqual(parsed.commonsQueries, ["Lighthouse keeper portrait", "Old sailor beard", "Fotoğrafçı"]);
  const fallback = parseCharacterResearch("geçersiz yanıt", "Gezgin");
  assert.deepEqual(fallback.commonsQueries, ["Gezgin"]);
});

test("DeepSeek prompt enhancement parsers normalize shot, character and repair outputs", () => {
  const shots = parseEnhancedShots(
    '```json\n{"shots":[{"id":"s1","image_prompt":"Cinematic 35mm wide shot at dawn","motion_prompt":"Slow dolly in through morning mist"}]}\n```',
    ["s1"],
  );
  assert.deepEqual(shots, [{ id: "s1", imagePrompt: "Cinematic 35mm wide shot at dawn", motionPrompt: "Slow dolly in through morning mist" }]);

  const character = parseEnhancedCharacter(
    '{"appearance":"elderly mountaineer with silver beard, weathered wool coat","style":"Cinematic realistic concept art"}',
    { appearance: "yaşlı dağcı", style: "Sinematik" },
  );
  assert.equal(character.appearance, "elderly mountaineer with silver beard, weathered wool coat");
  assert.equal(character.style, "Cinematic realistic concept art");

  const repair = parseEnhancedRepair(
    '{"instruction":"Redraw the left hand with five natural fingers matching the warm lighting"}',
    "sol eli 5 parmak yap",
  );
  assert.equal(repair, "Redraw the left hand with five natural fingers matching the warm lighting");
});
