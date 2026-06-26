/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import { getServerConfig } from "@agent-workbench/server/public";

describe("Security: localhost binding", () => {
  it("defaults to 127.0.0.1", () => {
    // Clear env to get defaults
    const prevHost = process.env.WORKBENCH_HOST;
    const prevPort = process.env.WORKBENCH_PORT;
    try {
      delete process.env.WORKBENCH_HOST;
      delete process.env.WORKBENCH_PORT;
      const config = getServerConfig();
      expect(config.host).toBe("127.0.0.1");
      expect(config.port).toBe(3000);
    } finally {
      if (prevHost !== undefined) process.env.WORKBENCH_HOST = prevHost;
      if (prevPort !== undefined) process.env.WORKBENCH_PORT = prevPort;
    }
  });

  it("allows localhost host", () => {
    const prevHost = process.env.WORKBENCH_HOST;
    try {
      process.env.WORKBENCH_HOST = "localhost";
      const config = getServerConfig();
      expect(config.host).toBe("localhost");
    } finally {
      if (prevHost !== undefined) process.env.WORKBENCH_HOST = prevHost;
      else delete process.env.WORKBENCH_HOST;
    }
  });

  it("allows ::1 host", () => {
    const prevHost = process.env.WORKBENCH_HOST;
    try {
      process.env.WORKBENCH_HOST = "::1";
      const config = getServerConfig();
      expect(config.host).toBe("::1");
    } finally {
      if (prevHost !== undefined) process.env.WORKBENCH_HOST = prevHost;
      else delete process.env.WORKBENCH_HOST;
    }
  });

  it("rejects non-loopback host", () => {
    const prevHost = process.env.WORKBENCH_HOST;
    try {
      process.env.WORKBENCH_HOST = "0.0.0.0";
      expect(() => getServerConfig()).toThrow("Non-loopback");
    } finally {
      if (prevHost !== undefined) process.env.WORKBENCH_HOST = prevHost;
      else delete process.env.WORKBENCH_HOST;
    }
  });

  it("rejects public IP host", () => {
    const prevHost = process.env.WORKBENCH_HOST;
    try {
      process.env.WORKBENCH_HOST = "192.168.1.1";
      expect(() => getServerConfig()).toThrow("Non-loopback");
    } finally {
      if (prevHost !== undefined) process.env.WORKBENCH_HOST = prevHost;
      else delete process.env.WORKBENCH_HOST;
    }
  });
});
