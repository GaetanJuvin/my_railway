import Docker from "dockerode";

export const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const NETWORK_NAME = "myrailway-internal";

export async function ensureNetwork(): Promise<void> {
  const networks = await docker.listNetworks({
    filters: { name: [NETWORK_NAME] },
  });
  if (networks.length === 0) {
    await docker.createNetwork({ Name: NETWORK_NAME, Driver: "bridge" });
  }
}

export async function buildImage(
  contextPath: string,
  tag: string,
  dockerfile: string = "Dockerfile",
  onLog?: (line: string) => void,
): Promise<string> {
  const stream = await docker.buildImage(
    { context: contextPath, src: ["."] },
    { t: tag, dockerfile },
  );

  return new Promise((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve(tag);
      },
      (event: { stream?: string }) => {
        if (event.stream && onLog) onLog(event.stream);
      },
    );
  });
}

export interface ContainerOptions {
  image: string;
  name: string;
  env: Record<string, string>;
  port?: number;
  volumes?: { host: string; container: string }[];
}

export async function createAndStartContainer(options: ContainerOptions): Promise<string> {
  await ensureNetwork();

  const envArray = Object.entries(options.env).map(([k, v]) => `${k}=${v}`);
  const portBindings: Record<string, { HostPort: string }[]> = {};
  const exposedPorts: Record<string, Record<never, never>> = {};

  if (options.port) {
    const containerPort = `${options.port}/tcp`;
    exposedPorts[containerPort] = {};
    portBindings[containerPort] = [{ HostPort: "0" }];
  }

  const binds = (options.volumes ?? []).map((v) => `${v.host}:${v.container}`);

  const container = await docker.createContainer({
    Image: options.image,
    name: options.name,
    Env: envArray,
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Binds: binds,
      NetworkMode: NETWORK_NAME,
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();
  return container.id;
}

export async function stopContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.stop().catch(() => undefined);
  await container.remove().catch(() => undefined);
}

export async function getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
  const container = docker.getContainer(containerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  return logs.toString();
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

export async function getContainerStats(containerId: string): Promise<ContainerStats> {
  const container = docker.getContainer(containerId);
  const stats = await container.stats({ stream: false });

  return {
    cpuPercent: calculateCpuPercent(stats),
    memoryUsageMb: (stats.memory_stats.usage ?? 0) / 1024 / 1024,
    memoryLimitMb: (stats.memory_stats.limit ?? 0) / 1024 / 1024,
    networkRxBytes: Object.values(
      (stats.networks ?? {}) as Record<string, { rx_bytes: number; tx_bytes: number }>,
    ).reduce((sum, n) => sum + (n.rx_bytes ?? 0), 0),
    networkTxBytes: Object.values(
      (stats.networks ?? {}) as Record<string, { rx_bytes: number; tx_bytes: number }>,
    ).reduce((sum, n) => sum + (n.tx_bytes ?? 0), 0),
  };
}

function calculateCpuPercent(stats: {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
  };
}): number {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus ?? 1;
  if (sysDelta > 0) {
    return (cpuDelta / sysDelta) * cpuCount * 100;
  }
  return 0;
}

export async function getContainerPort(
  containerId: string,
  containerPort: number,
): Promise<number | null> {
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  const portKey = `${containerPort}/tcp`;
  const bindings = info.NetworkSettings.Ports[portKey];
  if (bindings && bindings.length > 0) {
    return parseInt(bindings[0]?.HostPort ?? "", 10);
  }
  return null;
}

export async function listContainers(prefix: string) {
  return docker.listContainers({
    all: true,
    filters: { name: [prefix] },
  });
}
