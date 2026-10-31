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

interface ActiveTransports {
	channels: Set<string>;
	previous?: string;
}
// Shared by ESM/CJS bundles and independently configured reporter instances.
const registryKey = Symbol.for("ctrf.jest.metadataTransports");
const registryGlobal = globalThis as typeof globalThis & {
	[registryKey]?: ActiveTransports;
};
registryGlobal[registryKey] ??= { channels: new Set() };
const active = registryGlobal[registryKey];
const encodedChannels = (): string => JSON.stringify([...active.channels]);

export function currentMetadataChannels(): string[] {
	try {
		const channels: unknown = JSON.parse(process.env[CHANNEL] ?? "[]");
		return Array.isArray(channels)
			? channels.filter(
					(channel): channel is string =>
						typeof channel === "string" && /^[a-f0-9-]{36}$/.test(channel),
				)
			: [];
	} catch {
		return [];
	}
}

// A channel lasts for the reporter lifetime so reused watch workers keep it.
export class MetadataTransport {
	private readonly channel = randomUUID();
	start(): void {
		if (active.channels.size === 0) active.previous = process.env[CHANNEL];
		rmSync(directory(this.channel), { recursive: true, force: true });
		active.channels.add(this.channel);
		process.env[CHANNEL] = encodedChannels();
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
		const ownedEnvironment = process.env[CHANNEL] === encodedChannels();
		if (!active.channels.delete(this.channel)) return;
		if (ownedEnvironment) {
			if (active.channels.size > 0) process.env[CHANNEL] = encodedChannels();
			else if (active.previous === undefined) delete process.env[CHANNEL];
			else process.env[CHANNEL] = active.previous;
		}
	}
}

export function publishMetadata(
	channels: readonly string[],
	file: string,
	project: string,
	records: [string, TestMetadata][],
): void {
	if (channels.length === 0) return;
	const serialized = JSON.stringify(records);
	for (const channel of channels) {
		mkdirSync(directory(channel), { recursive: true, mode: 0o700 });
		writeFileSync(filename(channel, file, project), serialized, {
			mode: 0o600,
		});
	}
}
