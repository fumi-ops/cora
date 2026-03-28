export async function promptSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Secure prompt requires an interactive TTY.");
  }

  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    let secret = "";

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode?.(false);
      stdin.pause();
      stdout.write("\n");
    };

    const onData = (chunk: Buffer | string) => {
      const chars = chunk.toString("utf8");

      for (const char of chars) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Cancelled"));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(secret);
          return;
        }

        if (char === "\u007F") {
          secret = secret.slice(0, -1);
          continue;
        }

        secret += char;
      }
    };

    stdout.write(prompt);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
