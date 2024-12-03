import { walk } from "@std/fs/walk";
import * as path from "@std/path";

import { ZipWriter } from "zipjs";
import last from "@cordor/array-last";

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
