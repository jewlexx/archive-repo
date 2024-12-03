import { walk } from "jsr:@std/fs@^1.0.6/walk";
import * as path from "jsr:@std/path@^1.0.8";
import { parseArgs } from "jsr:@std/cli/parse-args";

import { ZipWriter } from "https://deno.land/x/zipjs@v2.7.53/index.js";
import last from "jsr:@cordor/array-last@^0.1.1";
import { Octokit } from "https://esm.sh/octokit@4.0.2?dts";

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

export async function gitRemote(gitPath: string) {
  const output = await new Deno.Command("git", {
    args: [
      `--git-dir=${gitPath}/.git`,
      `--work-tree=${gitPath}`,
      "remote",
      "-v",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();

  const outStr = new TextDecoder().decode(output.stdout);

  const remotes = outStr.split("\n");

  for (const remote of remotes) {
    if (remote.includes("(fetch)") && remote.startsWith("origin")) {
      return remote.split(/\s+/)[1];
    }
  }
}

export async function deleteGitRepo(remote: string) {
  const ockto = new Octokit({
    auth: Deno.env.get("GITHUB_TOKEN"),
  });

  console.log(parseGitRemote(remote));
  const { owner, repo: repoName } = parseGitRemote(remote);

  console.log("Deleting repo");

  await ockto.rest.repos.delete({
    owner,
    repo: repoName,
  });

  console.log("Deleted repo");
}

export function parseGitRemote(remote: string) {
  const splitRemote = remote.split("/");

  const repo = last(splitRemote).replace(".git", "");
  splitRemote.pop();
  const owner = last(splitRemote);

  return {
    owner,
    repo,
  };
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    boolean: ["deleteFiles", "deleteRepo"],
    string: ["dir"],
    default: {
      deleteFiles: true,
      deleteRepo: true,
    },
    negatable: ["deleteRepo", "deleteFiles"],
  });

  if (args.dir === undefined) {
    console.log("Missing argument: dir");
    Deno.exit(1);
  }

  const dir = path.resolve(args.dir);

  const archiveFile = resolveArchiveName(dir);
  const files = await archiveDirectory(archiveFile, dir);

  if (args.deleteFiles) {
    await deleteArchivedDirectory(files);
  }

  if (args.deleteRepo) {
    const remote = await gitRemote(dir);
    await deleteGitRepo(remote!);
  }
}
