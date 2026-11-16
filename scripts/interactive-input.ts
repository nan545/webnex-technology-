import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";

export function prompt(label: string) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  return terminal.question(label).finally(() => terminal.close());
}

export async function promptPassword(label: string) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Run this command from an interactive terminal.");
  }
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        process.stdin.off("keypress", onKeypress);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        reject(new Error("Password entry cancelled."));
      } else if (key.name === "return" || key.name === "enter") {
        process.stdin.off("keypress", onKeypress);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(value);
      } else if (key.name === "backspace") {
        value = value.slice(0, -1);
      } else if (!key.ctrl && text && text.length === 1 && text >= " ") {
        value += text;
      }
    };
    process.stdin.on("keypress", onKeypress);
  });
}
