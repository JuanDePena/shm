import type { IncomingMessage, IncomingHttpHeaders, ServerResponse } from "node:http";
import { Readable, Writable } from "node:stream";

class MockIncomingMessage extends Readable {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;

  constructor(args: {
    body?: string;
    headers?: IncomingHttpHeaders;
    method?: string;
    url?: string;
  }) {
    super();
    this.method = args.method;
    this.url = args.url;
    this.headers = args.headers ?? {};
    this.push(args.body ?? null);
    this.push(null);
  }

  _read(): void {
    // No-op: the constructor preloads the body.
  }
}

class MockServerResponse extends Writable {
  statusCode = 200;
  headers = new Map<string, string | string[]>();
  chunks: Buffer[] = [];

  _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  writeHead(statusCode: number, headers: Record<string, string | string[]> = {}): this {
    this.statusCode = statusCode;
    for (const [key, value] of Object.entries(headers)) {
      this.headers.set(key.toLowerCase(), value);
    }
    return this;
  }

  setHeader(name: string, value: string | string[]): void {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(chunkOrCallback?: string | Buffer | (() => void), encoding?: BufferEncoding | (() => void), callback?: () => void): this {
    if (typeof chunkOrCallback === "string" || Buffer.isBuffer(chunkOrCallback)) {
      this.chunks.push(
        Buffer.isBuffer(chunkOrCallback) ? chunkOrCallback : Buffer.from(chunkOrCallback)
      );
    }

    const completionCallback =
      typeof encoding === "function" ? encoding : callback;

    super.end();
    completionCallback?.();
    return this;
  }

  bodyText(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

export interface InvokedHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  bodyText: string;
}

export async function invokeRequestHandler(
  handler: (request: IncomingMessage, response: ServerResponse) => Promise<void> | void,
  request: {
    body?: string;
    headers?: IncomingHttpHeaders;
    method?: string;
    url: string;
  }
): Promise<InvokedHttpResponse> {
  const mockRequest = new MockIncomingMessage(request);
  const mockResponse = new MockServerResponse();

  await handler(
    mockRequest as unknown as IncomingMessage,
    mockResponse as unknown as ServerResponse
  );

  return {
    statusCode: mockResponse.statusCode,
    headers: Object.fromEntries(mockResponse.headers.entries()),
    bodyText: mockResponse.bodyText()
  };
}
