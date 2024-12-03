import { assertEquals } from "jsr:@std/assert@1";
import { resolveArchiveName } from "./main.ts";

Deno.test(function absolutePathTest() {
  assertEquals(
    resolveArchiveName("c:/Users/julie/dev/archive-repo"),
    "archive-repo.zip"
  );
});

Deno.test(function relativePathTest() {
  assertEquals(resolveArchiveName("."), "archive-repo.zip");
});
