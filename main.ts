import { walk } from "jsr:@std/fs@^1.0.6/walk";
import * as path from "jsr:@std/path@^1.0.8";

import { ZipWriter } from "https://deno.land/x/zipjs@v2.7.53/index.js";
import last from "jsr:@cordor/array-last@^0.1.1";

export function resolveArchiveName(dir: string) {
  return `${last(path.resolve(dir).split(path.SEPARATOR))}.zip`;
}

/**
 *
 * @param dest
 * @param dir
 * @returns A list of the files that were added to the archive
 */
export async function archiveDirectory(
  dest: string,
  dir: string
): Promise<string[]> {
  const fileList = [];

  const zipFileStream = new TransformStream();

  const destFile = await Deno.create(dest);
  const zipPiping = zipFileStream.readable.pipeTo(destFile.writable);

  const zipWriter = new ZipWriter(zipFileStream.writable);

  for await (const entry of walk(dir)) {
    if (entry.isFile) {
      if (entry.path == dest) {
        continue;
      }
      fileList.push(entry.path);
      console.log(`Archiving ${entry.path}`);
      await zipWriter.add(entry.path, await Deno.open(entry.path));
    }
  }

  console.log("Finalizing archive...");

  await zipWriter.close();
  await zipPiping;

  console.log("Finished archiving files");

  return fileList;
}

export async function deleteArchivedDirectory(files: string[]) {
  for (const file of files) {
    console.log(`Deleting ${file}`);
    await Deno.remove(file);
  }
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const dir = Deno.args[0];

  const archiveFile = resolveArchiveName(dir);
  const files = await archiveDirectory(archiveFile, dir);
  await deleteArchivedDirectory(files);
}
