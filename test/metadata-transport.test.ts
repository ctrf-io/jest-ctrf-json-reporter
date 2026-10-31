import Reporter from "../src/generate-report";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	MetadataTransport,
	currentMetadataChannel,
	publishMetadata,
} from "../src/metadata-transport";

describe("worker metadata handoff", () => {
	let transport: MetadataTransport;
	beforeEach(() => {
		transport = new MetadataTransport();
		transport.start();
	});
	afterEach(() => transport.finish());
	it("snapshots JSON metadata and consumes it once", () => {
		const extra = { nested: { value: 1 }, list: ["first"], omitted: undefined };
		publishMetadata(currentMetadataChannel(), "/file", "project", [
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
			publishMetadata(currentMetadataChannel(), file, project, [
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
		const channel = currentMetadataChannel();
		publishMetadata(channel, "/a", "", [["stale", { extra: { old: true } }]]);
		transport.finish();
		transport.start();
		expect(currentMetadataChannel()).toBe(channel);
		expect(transport.consume("/a", "").size).toBe(0);
		// Simulate an existing worker still holding its original channel.
		publishMetadata(channel, "/a", "", [["new", { extra: { fresh: true } }]]);
		expect(transport.consume("/a", "").get("new")?.extra).toEqual({
			fresh: true,
		});
	});
	it("removes unconsumed data and restores the previous environment", () => {
		const channel = currentMetadataChannel();
		const dir = path.join(tmpdir(), `ctrf-jest-${channel}`);
		publishMetadata(channel, "/a", "", [["test", { extra: {} }]]);
		expect(readdirSync(dir)).toHaveLength(1);
		transport.finish();
		expect(existsSync(dir)).toBe(false);
		expect(currentMetadataChannel()).not.toBe(channel);
	});
	it("cleans the handoff even when final report generation throws", () => {
		const reporter = new Reporter({} as never, {}, {} as never);
		reporter.onRunStart();
		const channel = currentMetadataChannel();
		const dir = path.join(tmpdir(), `ctrf-jest-${channel}`);
		publishMetadata(channel, "/a", "", [["test", { extra: {} }]]);
		(
			reporter as unknown as { writeReportToFile: () => void }
		).writeReportToFile = () => {
			throw new Error("write failed");
		};
		expect(() => reporter.onRunComplete()).toThrow("write failed");
		expect(existsSync(dir)).toBe(false);
		expect(currentMetadataChannel()).not.toBe(channel);
	});
});
