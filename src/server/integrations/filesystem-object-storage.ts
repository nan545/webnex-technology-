import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function resolveObjectPath(storagePath: string, key: string) {
  if (!isAbsolute(storagePath) || key.includes("\\") || key.includes("\0")) {
    throw new Error("Invalid filesystem object storage path or key.");
  }

  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid filesystem object storage key.");
  }

  const root = resolve(storagePath);
  const objectPath = resolve(root, ...segments);
  const pathFromRoot = relative(root, objectPath);
  if (
    !pathFromRoot ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error("Filesystem object storage key escapes its configured path.");
  }
  return { root, objectPath };
}

export async function putFileObject(storagePath: string, key: string, body: Buffer) {
  const { root, objectPath } = resolveObjectPath(storagePath, key);
  const objectDirectory = dirname(objectPath);
  await mkdir(objectDirectory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    await chmod(root, 0o700);
    await chmod(objectDirectory, 0o700);
  }
  await writeFile(objectPath, body, { flag: "wx", mode: 0o600 });
  if (process.platform !== "win32") await chmod(objectPath, 0o600);
}

export async function readFileObject(storagePath: string, key: string) {
  const { objectPath } = resolveObjectPath(storagePath, key);
  const body = await readFile(objectPath);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(body));
      controller.close();
    },
  });
}

export async function removeFileObject(storagePath: string, key: string) {
  const { objectPath } = resolveObjectPath(storagePath, key);
  try {
    await unlink(objectPath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}
