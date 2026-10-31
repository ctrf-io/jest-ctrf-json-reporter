import Reporter from "../src/generate-report";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	MetadataTransport,
	currentMetadataChannels,
	publishMetadata,
} from "../src/metadata-transport";

describe("worker metadata handoff", () => {
	let transport: MetadataTransport;
	beforeEach(() => {
		transport = new MetadataTransport();
		transport.start();
	});
	afterEach(() => transport.finish());
	for (const firstFinishesFirst of [true, false]) {
		it(`broadcasts to independent consumers and restores channels (${firstFinishesFirst ? "forward" : "reverse"} cleanup)`, () => {
			const original = process.env.CTRF_JEST_METADATA_CHANNEL;
			const second = new MetadataTransport();
			second.start();
			try {
				const channels = currentMetadataChannels();
				publishMetadata(channels, "/shared", "project", [
					["test", { extra: { owner: "team" } }],
				]);
				expect(
					transport.consume("/shared", "project").get("test")?.extra,
				).toEqual({ owner: "team" });
				expect(second.consume("/shared", "project").get("test")?.extra).toEqual(
					{ owner: "team" },
				);
				if (firstFinishesFirst) {
					transport.finish();
					expect(currentMetadataChannels()).toContain(channels.at(-1));
				} else {
					second.finish();
					expect(process.env.CTRF_JEST_METADATA_CHANNEL).toBe(original);
				}
			} finally {
				second.finish();
				transport.finish();
				transport.start();
			}
			expect(process.env.CTRF_JEST_METADATA_CHANNEL).toBe(original);
		});
	}
	it("snapshots JSON metadata and consumes it once", () => {
		const extra = { nested: { value: 1 }, list: ["first"], omitted: undefined };
		publishMetadata(currentMetadataChannels(), "/file", "project", [
			["test", { extra }],
		]);
		extra.nested.value = 2;
		expect(transport.consume("/file", "project").get("test")).toEqual({
			extra: { nested: { value: 1 }, list: ["first"] },
		});
		expect(transport.consume("/file", "project").size).toBe(0);
	});
	it("isolates identical test names across files and projects", () => {
		for (const [file, project] of [
			["/a", "one"],
			["/b", "one"],
			["/a", "two"],
		]) {
			publishMetadata(currentMetadataChannels(), file, project, [
				["same", { extra: { file, project } }],
			]);
		}
		for (const [file, project] of [
			["/a", "two"],
			["/a", "one"],
			["/b", "one"],
		]) {
			expect(transport.consume(file, project).get("same")?.extra).toEqual({
				file,
				project,
			});
		}
	});
	it("reuses the channel but discards stale watch-run data", () => {
		const channels = currentMetadataChannels();
		publishMetadata(channels, "/a", "", [["stale", { extra: { old: true } }]]);
		transport.finish();
		transport.start();
		expect(currentMetadataChannels()).toEqual(channels);
		expect(transport.consume("/a", "").size).toBe(0);
		// Simulate an existing worker still holding its original channel.
		publishMetadata(channels, "/a", "", [["new", { extra: { fresh: true } }]]);
		expect(transport.consume("/a", "").get("new")?.extra).toEqual({
			fresh: true,
		});
	});
	it("removes unconsumed data and restores the previous environment", () => {
		const channels = currentMetadataChannels();
		const channel = channels.at(-1);
		const dir = path.join(tmpdir(), `ctrf-jest-${channel}`);
		publishMetadata(channels, "/a", "", [["test", { extra: {} }]]);
		expect(readdirSync(dir)).toHaveLength(1);
		transport.finish();
		expect(existsSync(dir)).toBe(false);
		expect(currentMetadataChannels()).not.toContain(channel);
	});
	it("cleans the handoff even when final report generation throws", () => {
		const reporter = new Reporter({} as never, {}, {} as never);
		reporter.onRunStart();
		const channels = currentMetadataChannels();
		const channel = channels.at(-1);
		const dir = path.join(tmpdir(), `ctrf-jest-${channel}`);
		publishMetadata(channels, "/a", "", [["test", { extra: {} }]]);
		(
			reporter as unknown as { writeReportToFile: () => void }
		).writeReportToFile = () => {
			throw new Error("write failed");
		};
		expect(() => reporter.onRunComplete()).toThrow("write failed");
		expect(existsSync(dir)).toBe(false);
		expect(currentMetadataChannels()).not.toContain(channel);
	});
});
