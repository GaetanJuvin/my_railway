import { vi, describe, it, expect, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available inside vi.mock factory
const mocks = vi.hoisted(() => {
  const mockContainer = {
    id: "abc123container",
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    logs: vi.fn(),
    stats: vi.fn(),
    inspect: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockFollowProgress = vi.fn<any>(
    (_stream: unknown, onFinished: (err: Error | null, output: unknown[]) => void) => {
      onFinished(null, []);
    },
  );

  const mockDockerInstance = {
    listNetworks: vi.fn(),
    createNetwork: vi.fn().mockResolvedValue(undefined),
    buildImage: vi.fn(),
    createContainer: vi.fn().mockResolvedValue(mockContainer),
    getContainer: vi.fn().mockReturnValue(mockContainer),
    listContainers: vi.fn(),
    modem: { followProgress: mockFollowProgress },
  };

  return { mockContainer, mockDockerInstance, mockFollowProgress };
});

vi.mock("dockerode", () => ({
  default: vi.fn(() => mocks.mockDockerInstance),
}));

// Import AFTER vi.mock so the mock is in place
import {
  ensureNetwork,
  buildImage,
  createAndStartContainer,
  stopContainer,
  getContainerLogs,
  getContainerStats,
  getContainerPort,
  listContainers,
} from "../../app/lib/docker.server.js";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no networks exist
  mocks.mockDockerInstance.listNetworks.mockResolvedValue([]);
  // Default: createNetwork succeeds
  mocks.mockDockerInstance.createNetwork.mockResolvedValue(undefined);
  // Default: buildImage returns a stream
  mocks.mockDockerInstance.buildImage.mockResolvedValue({});
  // Reset follow progress to success
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mocks.mockFollowProgress.mockImplementation((...args: any[]) => {
    const onFinished = args[1] as (err: null, output: unknown[]) => void;
    onFinished(null, []);
  });
});

describe("ensureNetwork", () => {
  it("creates myrailway-internal bridge network when none exists", async () => {
    mocks.mockDockerInstance.listNetworks.mockResolvedValue([]);

    await ensureNetwork();

    expect(mocks.mockDockerInstance.listNetworks).toHaveBeenCalledWith({
      filters: { name: ["myrailway-internal"] },
    });
    expect(mocks.mockDockerInstance.createNetwork).toHaveBeenCalledWith({
      Name: "myrailway-internal",
      Driver: "bridge",
    });
  });

  it("does not create network when myrailway-internal already exists", async () => {
    mocks.mockDockerInstance.listNetworks.mockResolvedValue([{ Name: "myrailway-internal" }]);

    await ensureNetwork();

    expect(mocks.mockDockerInstance.createNetwork).not.toHaveBeenCalled();
  });
});

describe("buildImage", () => {
  it("builds image from context path with given tag and dockerfile", async () => {
    await buildImage("/tmp/context", "myrailway/app:abc123", "Dockerfile");

    expect(mocks.mockDockerInstance.buildImage).toHaveBeenCalledWith(
      { context: "/tmp/context", src: ["."] },
      { t: "myrailway/app:abc123", dockerfile: "Dockerfile" },
    );
  });

  it("uses Dockerfile as default when dockerfile not specified", async () => {
    await buildImage("/tmp/context", "myrailway/app:v1");

    expect(mocks.mockDockerInstance.buildImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dockerfile: "Dockerfile" }),
    );
  });

  it("returns the image tag on successful build", async () => {
    const result = await buildImage("/tmp/ctx", "myrailway/svc:1", "Dockerfile");

    expect(result).toBe("myrailway/svc:1");
  });

  it("calls onLog callback for each stream event", async () => {
    const logLines: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mocks.mockFollowProgress.mockImplementation((...args: any[]) => {
      const onFinished = args[1] as (err: null, output: unknown[]) => void;
      const onProgress = args[2] as (event: { stream?: string }) => void;
      onProgress({ stream: "Step 1/3 : FROM node:20\n" });
      onProgress({ stream: "Step 2/3 : COPY . .\n" });
      onProgress({}); // event without stream, should be ignored
      onFinished(null, []);
    });

    await buildImage("/tmp/ctx", "tag:v1", "Dockerfile", (line) => logLines.push(line));

    expect(logLines).toEqual(["Step 1/3 : FROM node:20\n", "Step 2/3 : COPY . .\n"]);
  });

  it("rejects when Docker reports a build error", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mocks.mockFollowProgress.mockImplementation((...args: any[]) => {
      const onFinished = args[1] as (err: Error, output: unknown[]) => void;
      onFinished(new Error("Build failed: no such file"), []);
    });

    await expect(buildImage("/tmp/ctx", "tag:v1", "Dockerfile")).rejects.toThrow(
      "Build failed: no such file",
    );
  });
});

describe("createAndStartContainer", () => {
  it("creates container with env vars formatted as KEY=VALUE", async () => {
    await createAndStartContainer({
      image: "myrailway/app:v1",
      name: "myrailway-app-abc",
      env: { PORT: "3000", NODE_ENV: "production" },
    });

    const call = mocks.mockDockerInstance.createContainer.mock.calls[0]?.[0];
    expect(call.Env).toEqual(expect.arrayContaining(["PORT=3000", "NODE_ENV=production"]));
  });

  it("binds container port to random host port when port specified", async () => {
    await createAndStartContainer({
      image: "myrailway/app:v1",
      name: "myrailway-app-abc",
      env: {},
      port: 8080,
    });

    const call = mocks.mockDockerInstance.createContainer.mock.calls[0]?.[0];
    expect(call.ExposedPorts).toEqual({ "8080/tcp": {} });
    expect(call.HostConfig.PortBindings).toEqual({
      "8080/tcp": [{ HostPort: "0" }],
    });
  });

  it("mounts volumes as host:container bind strings", async () => {
    await createAndStartContainer({
      image: "myrailway/app:v1",
      name: "myrailway-app-abc",
      env: {},
      volumes: [
        { host: "/data/vol1", container: "/app/data" },
        { host: "/data/vol2", container: "/app/uploads" },
      ],
    });

    const call = mocks.mockDockerInstance.createContainer.mock.calls[0]?.[0];
    expect(call.HostConfig.Binds).toEqual(["/data/vol1:/app/data", "/data/vol2:/app/uploads"]);
  });

  it("attaches container to myrailway-internal network", async () => {
    await createAndStartContainer({
      image: "myrailway/app:v1",
      name: "myrailway-app-abc",
      env: {},
    });

    const call = mocks.mockDockerInstance.createContainer.mock.calls[0]?.[0];
    expect(call.HostConfig.NetworkMode).toBe("myrailway-internal");
  });

  it("sets restart policy to unless-stopped", async () => {
    await createAndStartContainer({
      image: "myrailway/app:v1",
      name: "myrailway-app-abc",
      env: {},
    });

    const call = mocks.mockDockerInstance.createContainer.mock.calls[0]?.[0];
    expect(call.HostConfig.RestartPolicy).toEqual({ Name: "unless-stopped" });
  });

  it("returns the container ID after starting", async () => {
    const containerId = await createAndStartContainer({
      image: "myrailway/app:v1",
      name: "myrailway-app-abc",
      env: {},
    });

    expect(containerId).toBe("abc123container");
    expect(mocks.mockContainer.start).toHaveBeenCalledOnce();
  });

  it("calls ensureNetwork before creating the container", async () => {
    mocks.mockDockerInstance.listNetworks.mockResolvedValue([]);

    await createAndStartContainer({
      image: "myrailway/app:v1",
      name: "myrailway-app-abc",
      env: {},
    });

    // ensureNetwork must have been called (createNetwork because no network exists)
    expect(mocks.mockDockerInstance.createNetwork).toHaveBeenCalledWith({
      Name: "myrailway-internal",
      Driver: "bridge",
    });
  });
});

describe("stopContainer", () => {
  it("stops and removes the container by ID", async () => {
    await stopContainer("abc123container");

    expect(mocks.mockDockerInstance.getContainer).toHaveBeenCalledWith("abc123container");
    expect(mocks.mockContainer.stop).toHaveBeenCalledOnce();
    expect(mocks.mockContainer.remove).toHaveBeenCalledOnce();
  });

  it("does not throw if container is already stopped", async () => {
    mocks.mockContainer.stop.mockRejectedValue(new Error("container already stopped"));

    await expect(stopContainer("abc123container")).resolves.not.toThrow();
    expect(mocks.mockContainer.remove).toHaveBeenCalledOnce();
  });

  it("does not throw if container is already removed", async () => {
    mocks.mockContainer.stop.mockRejectedValue(new Error("no such container"));
    mocks.mockContainer.remove.mockRejectedValue(new Error("no such container"));

    await expect(stopContainer("abc123container")).resolves.not.toThrow();
  });
});

describe("getContainerLogs", () => {
  it("retrieves logs with stdout, stderr, timestamps and tail options", async () => {
    const mockLogBuffer = Buffer.from("2024-01-01 server started\n");
    mocks.mockContainer.logs.mockResolvedValue(mockLogBuffer);

    const logs = await getContainerLogs("abc123container", 50);

    expect(mocks.mockDockerInstance.getContainer).toHaveBeenCalledWith("abc123container");
    expect(mocks.mockContainer.logs).toHaveBeenCalledWith({
      stdout: true,
      stderr: true,
      tail: 50,
      timestamps: true,
    });
    expect(logs).toContain("server started");
  });

  it("defaults to tail 100 when not specified", async () => {
    mocks.mockContainer.logs.mockResolvedValue(Buffer.from(""));

    await getContainerLogs("abc123container");

    expect(mocks.mockContainer.logs).toHaveBeenCalledWith(expect.objectContaining({ tail: 100 }));
  });
});

describe("getContainerStats", () => {
  it("calculates CPU percentage from cpu_stats delta", async () => {
    mocks.mockContainer.stats.mockResolvedValue({
      cpu_stats: {
        cpu_usage: { total_usage: 2_000_000 },
        system_cpu_usage: 100_000_000,
        online_cpus: 4,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 1_000_000 },
        system_cpu_usage: 95_000_000,
      },
      memory_stats: { usage: 52_428_800, limit: 1_073_741_824 },
      networks: {
        eth0: { rx_bytes: 1024, tx_bytes: 512 },
        eth1: { rx_bytes: 2048, tx_bytes: 256 },
      },
    });

    const stats = await getContainerStats("abc123container");

    // cpuDelta=1_000_000, sysDelta=5_000_000, cpuCount=4
    // (1_000_000 / 5_000_000) * 4 * 100 = 80%
    expect(stats.cpuPercent).toBeCloseTo(80);
    expect(stats.memoryUsageMb).toBeCloseTo(50); // 52_428_800 / 1024 / 1024
    expect(stats.memoryLimitMb).toBeCloseTo(1024); // 1_073_741_824 / 1024 / 1024
    expect(stats.networkRxBytes).toBe(3072); // 1024 + 2048
    expect(stats.networkTxBytes).toBe(768); // 512 + 256
  });

  it("returns 0 CPU when system_cpu_usage delta is zero", async () => {
    mocks.mockContainer.stats.mockResolvedValue({
      cpu_stats: {
        cpu_usage: { total_usage: 1_000_000 },
        system_cpu_usage: 50_000_000,
        online_cpus: 2,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 1_000_000 },
        system_cpu_usage: 50_000_000,
      },
      memory_stats: { usage: 0, limit: 0 },
      networks: {},
    });

    const stats = await getContainerStats("abc123container");

    expect(stats.cpuPercent).toBe(0);
  });

  it("handles missing networks gracefully returning 0 bytes", async () => {
    mocks.mockContainer.stats.mockResolvedValue({
      cpu_stats: {
        cpu_usage: { total_usage: 0 },
        system_cpu_usage: 0,
        online_cpus: 1,
      },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
      memory_stats: { usage: 0, limit: 0 },
      // no networks field
    });

    const stats = await getContainerStats("abc123container");

    expect(stats.networkRxBytes).toBe(0);
    expect(stats.networkTxBytes).toBe(0);
  });
});

describe("getContainerPort", () => {
  it("returns the host port bound to the given container port", async () => {
    mocks.mockContainer.inspect.mockResolvedValue({
      NetworkSettings: {
        Ports: {
          "3000/tcp": [{ HostPort: "49152" }],
        },
      },
    });

    const port = await getContainerPort("abc123container", 3000);

    expect(port).toBe(49152);
  });

  it("returns null when no binding exists for the container port", async () => {
    mocks.mockContainer.inspect.mockResolvedValue({
      NetworkSettings: {
        Ports: {},
      },
    });

    const port = await getContainerPort("abc123container", 3000);

    expect(port).toBeNull();
  });

  it("returns null when port bindings array is empty", async () => {
    mocks.mockContainer.inspect.mockResolvedValue({
      NetworkSettings: {
        Ports: {
          "3000/tcp": [],
        },
      },
    });

    const port = await getContainerPort("abc123container", 3000);

    expect(port).toBeNull();
  });
});

describe("listContainers", () => {
  it("lists all containers (including stopped) filtered by name prefix", async () => {
    const mockContainerList = [
      { Id: "abc", Names: ["/myrailway-app-abc"], State: "running" },
      { Id: "def", Names: ["/myrailway-app-def"], State: "exited" },
    ];
    mocks.mockDockerInstance.listContainers = vi.fn().mockResolvedValue(mockContainerList);

    const result = await listContainers("myrailway-app");

    expect(mocks.mockDockerInstance.listContainers).toHaveBeenCalledWith({
      all: true,
      filters: { name: ["myrailway-app"] },
    });
    expect(result).toEqual(mockContainerList);
  });
});
