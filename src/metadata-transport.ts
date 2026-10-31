import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestMetadata } from "./storage";

const CHANNEL = "CTRF_JEST_METADATA_CHANNEL";
const directory = (channel: string): string =>
	path.join(tmpdir(), `ctrf-jest-${channel}`);
const filename = (channel: string, file: string, project: string): string =>
	path.join(
		directory(channel),
		`${createHash("sha256")
			.update(JSON.stringify([file, project]))
			.digest("hex")}.json`,
	);

export function currentMetadataChannel(): string | undefined {
	const channel = process.env[CHANNEL];
	return channel && /^[a-f0-9-]{36}$/.test(channel) ? channel : undefined;
}

// A channel lasts for the reporter lifetime so reused watch workers keep it.
export class MetadataTransport {
	private readonly channel = randomUUID();
	private previous: string | undefined;
	start(): void {
		if (process.env[CHANNEL] !== this.channel)
			this.previous = process.env[CHANNEL];
		rmSync(directory(this.channel), { recursive: true, force: true });
		process.env[CHANNEL] = this.channel;
	}
	consume(file: string, project: string): Map<string, TestMetadata> {
		const source = filename(this.channel, file, project);
		if (!existsSync(source)) return new Map();
		const records = JSON.parse(readFileSync(source, "utf8")) as [
			string,
			TestMetadata,
		][];
		rmSync(source);
		return new Map(records);
	}
	finish(): void {
		rmSync(directory(this.channel), { recursive: true, force: true });
		if (process.env[CHANNEL] === this.channel) {
			if (this.previous === undefined) delete process.env[CHANNEL];
			else process.env[CHANNEL] = this.previous;
		}
	}
}

export function publishMetadata(
	channel: string | undefined,
	file: string,
	project: string,
	records: [string, TestMetadata][],
): void {
	if (!channel) return;
	mkdirSync(directory(channel), { recursive: true, mode: 0o700 });
	writeFileSync(filename(channel, file, project), JSON.stringify(records), {
		mode: 0o600,
	});
}
