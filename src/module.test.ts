/* eslint-disable no-console */

const MATTER_PORT = 6000;
const NAME = 'Platform';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'platform.test.js', '-novirtual', '-frontend', '0', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';
import {
  addBridgedEndpointSpy,
  addMatterbridgePlatform,
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  flushAsync,
  log,
  loggerLogSpy,
  logKeepAlives,
  matterbridge,
  removeAllBridgedEndpointsSpy,
  setDebug,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from 'matterbridge/jestutils';
import { BLUE, CYAN, ign, LogLevel, nf, rs, YELLOW } from 'matterbridge/logger';
import { Identify, OnOff, WindowCovering } from 'matterbridge/matter/clusters';
import { wait } from 'matterbridge/utils';
import { Client, Device } from 'overkiz-client';

import initializePlugin, { SomfyTahomaPlatform, SomfyTahomaPlatformConfig, WC_PERCENT100THS_MAX_CLOSED, WC_PERCENT100THS_MIN_OPEN } from './module.js';

// Spy on the Client.connect method
const clientConnectSpy = jest.spyOn(Client.prototype, 'connect').mockImplementation((user: string, password: string) => {
  // console.error(`Mocked Client.connect(${user}, ${password})`);
  return Promise.resolve();
});
const clientGetDevicesSpy = jest.spyOn(Client.prototype, 'getDevices').mockImplementation(() => {
  // console.error(`Mocked Client.getDevices()`);
  return Promise.resolve([]);
});
const clientExecuteSpy = jest.spyOn(Client.prototype, 'execute').mockImplementation((oid: any, execution: any) => {
  // console.error(`Mocked Client.execute(${oid}, ${execution})`);
  return Promise.resolve();
});

const WindowCoveringCluster = WindowCovering.Cluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift);

// Setup the test environment
await setupTest(NAME, false);

describe('TestPlatform', () => {
  let somfyPlatform: SomfyTahomaPlatform;

  const config: SomfyTahomaPlatformConfig = {
    name: 'matterbridge-somfy-tahoma',
    type: 'DynamicPlatform',
    version: '1.4.0',
    username: 'None',
    password: 'None',
    service: 'somfy_europe',
    movementDuration: {
      Device1: 2,
    },
    blackList: [],
    whiteList: [],
    exposeMyPositionSwitch: true,
    myPositionSuffix: 'My',
    myPositionAlias: 'favorite1',
    debug: false,
    unregisterOnShutdown: false,
  };

  const createMockDevice = ({
    label = 'Device1',
    uniqueName = 'Blind',
    uiClass = 'Screen',
    commands = ['open', 'close', 'stop'],
  }: {
    label?: string;
    uniqueName?: string;
    uiClass?: string;
    commands?: string[];
  }): Device => {
    const device = new Device();
    device.deviceURL = 'url';
    device.label = label;
    device.controllableName = `io:${uniqueName}`;
    device.definition = {
      type: '',
      widgetName: '',
      uiClass,
      commands: commands.map((commandName) => ({ commandName, nparams: 0 })),
    };
    device.states = [];
    return device;
  };

  const setMockDevice = ({
    label = 'Device1',
    uniqueName = 'Blind',
    uiClass = 'Screen',
    commands = ['open', 'close', 'stop'],
  }: {
    label?: string;
    uniqueName?: string;
    uiClass?: string;
    commands?: string[];
  }) => {
    mockDevices[0] = createMockDevice({ label, uniqueName, uiClass, commands });
  };

  const mockDevices = [createMockDevice({})];

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(async () => {
    // Reset the mock calls before each test
    jest.clearAllMocks();
    setMockDevice({});
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();

    // Restore all mocks
    jest.restoreAllMocks();

    // logKeepAlives();
  });

  it('should return an instance of SomfyTahomaPlatform', async () => {
    const result = initializePlugin(matterbridge, log, config);
    expect(result).toBeInstanceOf(SomfyTahomaPlatform);
    await result.onShutdown();
  });

  it('should not initialize platform without username and password', async () => {
    config.username = '';
    config.password = '';
    config.service = '';
    somfyPlatform = new SomfyTahomaPlatform(matterbridge, log, config);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'No service or username or password provided for:', config.name);
    await somfyPlatform.onShutdown();
  });

  it('should initialize platform with config name', () => {
    config.username = 'None';
    config.password = 'None';
    config.service = 'somfy_europe';
    somfyPlatform = new SomfyTahomaPlatform(matterbridge, log, config);
    addMatterbridgePlatform(somfyPlatform);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Finished initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Starting client Tahoma service somfy_europe with user None password: None');
  });

  it('should receive tahomaClient events', () => {
    somfyPlatform.tahomaClient?.emit('connect');
    somfyPlatform.tahomaClient?.emit('disconnect');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'TaHoma service connected');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, 'TaHoma service disconnected');
  });

  it('should throw because of version', () => {
    const savedVersion = matterbridge.matterbridgeVersion;
    matterbridge.matterbridgeVersion = '1.5.4';
    expect(() => new SomfyTahomaPlatform(matterbridge, log, config)).toThrow();
    matterbridge.matterbridgeVersion = savedVersion;
  });

  it('should call onStart with reason', async () => {
    await somfyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onStart called with reason:', 'Test reason');
    expect(clientConnectSpy).toHaveBeenCalledWith('None', 'None');
  });

  it('should call onStart with reason and log error', async () => {
    const client = somfyPlatform.tahomaClient;
    somfyPlatform.tahomaClient = undefined;
    await somfyPlatform.onStart();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'TaHoma service not created');
    expect(clientConnectSpy).not.toHaveBeenCalledWith('None', 'None');
    somfyPlatform.tahomaClient = client;
  });

  it('should call onStart with reason and log error if connect throws', async () => {
    clientConnectSpy.mockImplementationOnce(() => {
      throw new Error('Error connecting to TaHoma service');
    });
    await somfyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onStart called with reason:', 'Test reason');
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, 'TaHoma service not created');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error connecting to TaHoma service'));
    expect(clientConnectSpy).toHaveBeenCalledWith('None', 'None');
  });

  it('should discover devices and log error', async () => {
    const client = somfyPlatform.tahomaClient;
    somfyPlatform.tahomaClient = undefined;
    await somfyPlatform.discoverDevices();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'TaHoma service not created');
    somfyPlatform.tahomaClient = client;
  });

  it('should log an error if writeFile fails', async () => {
    const fileName = path.join(matterbridge.matterbridgePluginDirectory, 'matterbridge-somfy-tahoma', 'devices.json');
    const errorMessage = 'Error writing file';
    jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error(errorMessage));
    await somfyPlatform.discoverDevices();
    await wait(1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
  });

  it('should discover devices and log error if getDevices throws', async () => {
    clientGetDevicesSpy.mockImplementationOnce(() => {
      throw new Error('Error getting devices from TaHoma service');
    });
    await somfyPlatform.discoverDevices();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error discovering TaHoma devices'));
  });

  it('should discover devices and not add if in black list', async () => {
    somfyPlatform.config.blackList = ['Device1'];
    clientGetDevicesSpy.mockImplementationOnce(() => {
      return Promise.resolve(mockDevices);
    });
    await somfyPlatform.discoverDevices();
    expect(addBridgedEndpointSpy).toHaveBeenCalledTimes(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma devices`);
    expect(somfyPlatform.tahomaDevices).toHaveLength(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma screens`);
    expect(somfyPlatform.bridgedDevices).toHaveLength(0);
    expect(somfyPlatform.covers.size).toBe(0);
    somfyPlatform.config.blackList = [];
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
  });

  it('should discover devices with uniqueName Blind', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'Blind' });
    clientGetDevicesSpy.mockImplementationOnce(() => {
      return Promise.resolve(mockDevices);
    });
    await somfyPlatform.discoverDevices();
    expect(addBridgedEndpointSpy).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma devices`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `- added with uniqueName`);
    expect(somfyPlatform.tahomaDevices).toHaveLength(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma screens`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Adding device: ${BLUE}${mockDevices[0].label}${rs}`);
    expect(somfyPlatform.bridgedDevices).toHaveLength(1);
    expect(somfyPlatform.covers.size).toBe(1);
    console.log('Deleting device');
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    expect(aggregator.parts.size).toBe(0);
    expect(matterbridge.devices.size).toBe(0);
    await flushAsync();
  });

  it('should discover devices with uiClass Screen', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'Screen' });
    clientGetDevicesSpy.mockImplementationOnce(() => {
      return Promise.resolve(mockDevices);
    });
    await somfyPlatform.discoverDevices();
    expect(addBridgedEndpointSpy).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma devices`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `- added with uiClass`);
    expect(somfyPlatform.tahomaDevices).toHaveLength(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma screens`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Adding device: ${BLUE}${mockDevices[0].label}${rs}`);
    expect(somfyPlatform.bridgedDevices).toHaveLength(1);
    expect(somfyPlatform.covers.size).toBe(1);
    console.log('Deleting device');
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    expect(aggregator.parts.size).toBe(0);
    expect(matterbridge.devices.size).toBe(0);
    await flushAsync();
  });

  it('should discover devices with command "open", "close" and "stop"', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop'] });
    clientGetDevicesSpy.mockImplementationOnce(() => {
      return Promise.resolve(mockDevices);
    });
    await somfyPlatform.discoverDevices();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma devices`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `- added with commands "open", "close" and "stop"`);
    expect(somfyPlatform.tahomaDevices).toHaveLength(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma screens`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Adding device: ${BLUE}${mockDevices[0].label}${rs}`);
    expect(somfyPlatform.bridgedDevices).toHaveLength(1);
    expect(somfyPlatform.covers.size).toBe(1);

    somfyPlatform.sendCommand('identify', mockDevices[0]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Sending command ${YELLOW}identify${nf} highPriority false`);
    somfyPlatform.sendCommand('open', mockDevices[0]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Sending command ${YELLOW}open${nf} highPriority false`);
    somfyPlatform.sendCommand('stop', mockDevices[0]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Sending command ${YELLOW}stop${nf} highPriority false`);
    somfyPlatform.sendCommand('close', mockDevices[0]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Sending command ${YELLOW}close${nf} highPriority false`);

    clientExecuteSpy.mockImplementationOnce(() => {
      throw new Error('Error executing command');
    });
    somfyPlatform.sendCommand('close', mockDevices[0]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error sending command`));

    const device = somfyPlatform.covers.get('Device1')?.bridgedDevice;
    expect(device).toBeDefined();
    if (!device) return;
    await device.setWindowCoveringCurrentTargetStatus(WC_PERCENT100THS_MIN_OPEN, WC_PERCENT100THS_MIN_OPEN, WindowCovering.MovementStatus.Stopped);

    jest.clearAllMocks();
    await device.executeCommandHandler('Identify.identify', { identifyTime: 1 }, 'identify', (device.state as any).identify, device);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Command ${ign}identify${rs}${nf} called identifyTime:1`);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.downOrClose', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(3000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Command ${ign}downOrClose${rs}${nf} called for ${CYAN}${mockDevices[0].label}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from ${WC_PERCENT100THS_MIN_OPEN} to ${WC_PERCENT100THS_MAX_CLOSED}...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Moving stopped at ${WC_PERCENT100THS_MAX_CLOSED}`);
    expect(device.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths')).toBe(WC_PERCENT100THS_MAX_CLOSED);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.upOrOpen', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(3000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Command ${ign}upOrOpen${rs}${nf} called for ${CYAN}${mockDevices[0].label}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from ${WC_PERCENT100THS_MAX_CLOSED} to ${WC_PERCENT100THS_MIN_OPEN}...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Moving stopped at ${WC_PERCENT100THS_MIN_OPEN}`);
    expect(device.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths')).toBe(WC_PERCENT100THS_MIN_OPEN);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.upOrOpen', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(3000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Command ${ign}upOrOpen${rs}${nf} called for ${CYAN}${mockDevices[0].label}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from ${WC_PERCENT100THS_MIN_OPEN} to ${WC_PERCENT100THS_MIN_OPEN}...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from ${WC_PERCENT100THS_MIN_OPEN} to ${WC_PERCENT100THS_MIN_OPEN}. No movement needed.`);
    expect(device.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths')).toBe(WC_PERCENT100THS_MIN_OPEN);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.goToLiftPercentage', { liftPercent100thsValue: 5000 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(3000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Command ${ign}goToLiftPercentage${rs}${nf} ${CYAN}5000${nf} called for ${CYAN}${mockDevices[0].label}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from ${WC_PERCENT100THS_MIN_OPEN} to 5000...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Moving stopped at 5000`);
    expect(device.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths')).toBe(5000);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.goToLiftPercentage', { liftPercent100thsValue: 10000 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(3000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Command ${ign}goToLiftPercentage${rs}${nf} ${CYAN}10000${nf} called for ${CYAN}${mockDevices[0].label}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from 5000 to ${WC_PERCENT100THS_MAX_CLOSED}...`);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.downOrClose', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from ${WC_PERCENT100THS_MAX_CLOSED} to ${WC_PERCENT100THS_MAX_CLOSED}...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Moving from ${WC_PERCENT100THS_MAX_CLOSED} to ${WC_PERCENT100THS_MAX_CLOSED}. No movement needed.`);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.downOrClose', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(1000);
    expect(device.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths')).toBe(WC_PERCENT100THS_MAX_CLOSED);

    await device.executeCommandHandler('WindowCovering.upOrOpen', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await device.executeCommandHandler('WindowCovering.stopMotion', {}, 'windowCovering', {} as any, device);
    await device.executeCommandHandler('WindowCovering.downOrClose', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await device.executeCommandHandler('WindowCovering.upOrOpen', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await device.executeCommandHandler('WindowCovering.stopMotion', {}, 'windowCovering', {} as any, device);

    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    expect(aggregator.parts.size).toBe(0);
    expect(matterbridge.devices.size).toBe(0);
    await flushAsync();
  }, 120000);

  it('should create a My-position trigger when device supports "my"', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'my'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();
    expect(somfyPlatform.covers.size).toBe(1);
    expect(somfyPlatform.myTriggers.size).toBe(1);
    const trigger = somfyPlatform.myTriggers.get('Device1 My');
    expect(trigger).toBeDefined();
    expect(trigger?.command).toBe('my');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('added My-position trigger'));

    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    somfyPlatform.myTriggers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  });

  it('should create a My-position trigger when device supports "myPosition"', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'myPosition'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();
    expect(somfyPlatform.myTriggers.size).toBe(1);
    expect(somfyPlatform.myTriggers.get('Device1 My')?.command).toBe('myPosition');

    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    somfyPlatform.myTriggers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  });

  it('should create a My-position trigger using goToAlias when device supports it', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'goToAlias'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();
    expect(somfyPlatform.myTriggers.size).toBe(1);
    const trigger = somfyPlatform.myTriggers.get('Device1 My');
    expect(trigger?.command).toBe('goToAlias');
    expect(trigger?.commandParam).toBe('favorite1');
    if (!trigger) return;

    jest.clearAllMocks();
    const triggerEndpoint = trigger.bridgedDevice;
    await triggerEndpoint.executeCommandHandler('OnOff.on', {}, 'onOff', (triggerEndpoint.state as any).onOff, triggerEndpoint);
    expect(clientExecuteSpy).toHaveBeenCalledWith('apply/highPriority', expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('goToAlias favorite1'));

    await wait(2000);
    expect(triggerEndpoint.getAttribute(OnOff.Cluster.id, 'onOff')).toBe(false);

    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    somfyPlatform.myTriggers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  }, 15000);

  it('should honor custom myPositionAlias for goToAlias devices', async () => {
    somfyPlatform.config.myPositionAlias = 'favorite2';
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'goToAlias'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();
    expect(somfyPlatform.myTriggers.get('Device1 My')?.commandParam).toBe('favorite2');

    somfyPlatform.config.myPositionAlias = 'favorite1';
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    somfyPlatform.myTriggers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  });

  it('should not create a My-position trigger when device does not support "my"', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();
    expect(somfyPlatform.covers.size).toBe(1);
    expect(somfyPlatform.myTriggers.size).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining("no 'my', 'myPosition' or 'goToAlias' command"));

    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  });

  it('should send "my" on OnOff.on and auto-reset to off after ~1.5s', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'my'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const trigger = somfyPlatform.myTriggers.get('Device1 My');
    expect(trigger).toBeDefined();
    if (!trigger) return;
    const triggerEndpoint = trigger.bridgedDevice;

    jest.clearAllMocks();
    await triggerEndpoint.executeCommandHandler('OnOff.on', {}, 'onOff', (triggerEndpoint.state as any).onOff, triggerEndpoint);
    expect(clientExecuteSpy).toHaveBeenCalledWith('apply/highPriority', expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Sending command ${YELLOW}my${nf} highPriority true`);

    await wait(2000);
    expect(triggerEndpoint.getAttribute(OnOff.Cluster.id, 'onOff')).toBe(false);

    jest.clearAllMocks();
    await triggerEndpoint.executeCommandHandler('OnOff.off', {}, 'onOff', (triggerEndpoint.state as any).onOff, triggerEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('off'));

    jest.clearAllMocks();
    await triggerEndpoint.executeCommandHandler('Identify.identify', { identifyTime: 1 }, 'identify', (triggerEndpoint.state as any).identify, triggerEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('identify'));

    // Trigger a fresh OnOff.on so resetTimeout is still pending, then onShutdown must clear it
    await triggerEndpoint.executeCommandHandler('OnOff.on', {}, 'onOff', (triggerEndpoint.state as any).onOff, triggerEndpoint);
    expect(somfyPlatform.myTriggers.get('Device1 My')?.resetTimeout).toBeDefined();
    const savedClient = somfyPlatform.tahomaClient;
    await somfyPlatform.onShutdown('Test cleanup');
    expect(somfyPlatform.myTriggers.size).toBe(0);
    somfyPlatform.tahomaClient = savedClient;

    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    somfyPlatform.myTriggers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  }, 15000);

  it('should not expose cover or My-trigger for blacklisted devices', async () => {
    somfyPlatform.config.blackList = ['Device1'];
    setMockDevice({ label: 'Device1', uniqueName: 'Blind', commands: ['open', 'close', 'stop', 'my'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();
    expect(somfyPlatform.covers.size).toBe(0);
    expect(somfyPlatform.myTriggers.size).toBe(0);
    somfyPlatform.config.blackList = [];
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
  });

  it('should not create My-trigger when exposeMyPositionSwitch is false', async () => {
    somfyPlatform.config.exposeMyPositionSwitch = false;
    setMockDevice({ label: 'Device1', uniqueName: 'Blind', commands: ['open', 'close', 'stop', 'my'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();
    expect(somfyPlatform.covers.size).toBe(1);
    expect(somfyPlatform.myTriggers.size).toBe(0);

    somfyPlatform.config.exposeMyPositionSwitch = true;
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  });

  const commandsFromLastExecute = () => {
    const calls = clientExecuteSpy.mock.calls;
    const last = calls[calls.length - 1];
    const execution: any = last?.[1];
    return execution?.actions?.[0]?.commands ?? [];
  };

  const resetPlatform = async () => {
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    somfyPlatform.myTriggers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    await flushAsync();
  };

  it('should detect setOrientation as tilt-capable and expose tilt attributes', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    expect(cover).toBeDefined();
    expect(cover?.tiltCommand).toBe('setOrientation');
    expect(cover?.hasSetClosure).toBe(true);
    expect(cover?.currentTilt).toBe(5000);
    expect(cover?.bridgedDevice.hasAttributeServer(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(true);

    await resetPlatform();
  });

  it('should detect setTilt when setOrientation is absent', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setTilt'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    expect(cover?.tiltCommand).toBe('setTilt');
    expect(cover?.bridgedDevice.hasAttributeServer(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(true);

    await resetPlatform();
  });

  it('should leave non-tilt covers lift-only (no tilt attributes)', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    expect(cover?.tiltCommand).toBeUndefined();
    expect(cover?.hasSetClosure).toBe(false);
    expect(cover?.bridgedDevice.hasAttributeServer(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(false);

    await resetPlatform();
  });

  it('should send setClosure(int) for goToLiftPercentage on setClosure-capable cover', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    expect(cover).toBeDefined();
    if (!cover) return;
    const device = cover.bridgedDevice;

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.goToLiftPercentage', { liftPercent100thsValue: 5000 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(700);

    const commands = commandsFromLastExecute();
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('setClosure');
    expect(commands[0].parameters).toEqual([50]);
    expect(clientExecuteSpy).toHaveBeenCalledWith('apply/highPriority', expect.anything());
    expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths')).toBe(5000);

    await resetPlatform();
  });

  it('should send setOrientation(int) for goToTiltPercentage', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    if (!cover) return;
    const device = cover.bridgedDevice;

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.goToTiltPercentage', { tiltPercent100thsValue: 7500 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(700);

    const commands = commandsFromLastExecute();
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('setOrientation');
    expect(commands[0].parameters).toEqual([75]);
    expect(cover.currentTilt).toBe(7500);
    expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(7500);

    await resetPlatform();
  });

  it('should be a no-op when flushPendingMove runs with no pending changes', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    if (!cover) return;

    jest.clearAllMocks();
    await somfyPlatform.flushPendingMove(cover);
    expect(clientExecuteSpy).not.toHaveBeenCalled();

    // pendingTilt without a tiltCommand should also produce no dispatch (defensive guard).
    cover.pendingTilt = 5000;
    cover.tiltCommand = undefined;
    await somfyPlatform.flushPendingMove(cover);
    expect(clientExecuteSpy).not.toHaveBeenCalled();

    await resetPlatform();
  });

  it('should bundle lift+tilt arriving within the 500 ms window into one Action', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    if (!cover) return;
    const device = cover.bridgedDevice;

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.goToLiftPercentage', { liftPercent100thsValue: 3000 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(50);
    await device.executeCommandHandler('WindowCovering.goToTiltPercentage', { tiltPercent100thsValue: 8000 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(700);

    expect(clientExecuteSpy).toHaveBeenCalledTimes(1);
    const commands = commandsFromLastExecute();
    expect(commands).toHaveLength(2);
    expect(commands[0].name).toBe('setClosure');
    expect(commands[0].parameters).toEqual([30]);
    expect(commands[1].name).toBe('setOrientation');
    expect(commands[1].parameters).toEqual([80]);
    expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths')).toBe(3000);
    expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(8000);

    await resetPlatform();
  });

  it('should NOT bundle lift then tilt arriving outside the 500 ms window', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    if (!cover) return;
    const device = cover.bridgedDevice;

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.goToLiftPercentage', { liftPercent100thsValue: 2000 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(700);
    expect(clientExecuteSpy).toHaveBeenCalledTimes(1);
    expect(commandsFromLastExecute()).toHaveLength(1);

    await device.executeCommandHandler('WindowCovering.goToTiltPercentage', { tiltPercent100thsValue: 6000 }, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(700);
    expect(clientExecuteSpy).toHaveBeenCalledTimes(2);
    const secondCallCommands = commandsFromLastExecute();
    expect(secondCallCommands).toHaveLength(1);
    expect(secondCallCommands[0].name).toBe('setOrientation');

    await resetPlatform();
  });

  it('should drive both axes for upOrOpen and downOrClose on tilt-capable covers', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    if (!cover) return;
    const device = cover.bridgedDevice;

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.downOrClose', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(700);
    let commands = commandsFromLastExecute();
    expect(commands).toHaveLength(2);
    expect(commands[0].name).toBe('setClosure');
    expect(commands[0].parameters).toEqual([100]);
    expect(commands[1].name).toBe('setOrientation');
    expect(commands[1].parameters).toEqual([100]);

    jest.clearAllMocks();
    await device.executeCommandHandler('WindowCovering.upOrOpen', {}, 'windowCovering', (device.state as any).windowCovering, device);
    await wait(700);
    commands = commandsFromLastExecute();
    expect(commands).toHaveLength(2);
    expect(commands[0].name).toBe('setClosure');
    expect(commands[0].parameters).toEqual([0]);
    expect(commands[1].name).toBe('setOrientation');
    expect(commands[1].parameters).toEqual([0]);

    await resetPlatform();
  });

  it('should cancel an in-flight simulated movement when a bundled command flushes', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    if (!cover) return;

    cover.movementStatus = WindowCovering.MovementStatus.Opening;
    cover.moveInterval = setInterval(() => {
      /* noop */
    }, 1000);

    cover.pendingLift = 4000;
    cover.pendingTilt = 6000;

    jest.clearAllMocks();
    await somfyPlatform.flushPendingMove(cover);
    expect(cover.moveInterval).toBeUndefined();
    expect(cover.movementStatus).toBe(WindowCovering.MovementStatus.Stopped);
    expect(clientExecuteSpy).toHaveBeenCalledTimes(1);

    await resetPlatform();
  });

  it('should honor disableTilt override and expose lift-only cluster', async () => {
    somfyPlatform.config.disableTilt = ['Device1'];
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['open', 'close', 'stop', 'setClosure', 'setOrientation'] });
    clientGetDevicesSpy.mockImplementationOnce(() => Promise.resolve(mockDevices));
    await somfyPlatform.discoverDevices();

    const cover = somfyPlatform.covers.get('Device1');
    expect(cover?.tiltCommand).toBeUndefined();
    expect(cover?.hasSetClosure).toBe(true);
    expect(cover?.bridgedDevice.hasAttributeServer(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(false);

    somfyPlatform.config.disableTilt = [];
    await resetPlatform();
  });

  it('should discover devices with command "rollOut", "rollUp" and "stop"', async () => {
    await setDebug(false);
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['rollOut', 'rollUp', 'stop'] });
    clientGetDevicesSpy.mockImplementationOnce(() => {
      return Promise.resolve(mockDevices);
    });
    await somfyPlatform.discoverDevices();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma devices`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `- added with commands "rollOut", "rollUp" and "stop"`);
    expect(somfyPlatform.tahomaDevices).toHaveLength(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma screens`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Adding device: ${BLUE}${mockDevices[0].label}${rs}`);
    expect(somfyPlatform.bridgedDevices).toHaveLength(1);
    expect(somfyPlatform.covers.size).toBe(1);
    somfyPlatform.sendCommand('identify', mockDevices[0]);
    somfyPlatform.sendCommand('open', mockDevices[0]);
    somfyPlatform.sendCommand('stop', mockDevices[0]);
    somfyPlatform.sendCommand('close', mockDevices[0]);
    somfyPlatform.tahomaDevices = [];
    somfyPlatform.bridgedDevices = [];
    somfyPlatform.covers.clear();
    await somfyPlatform.unregisterAllDevices();
    matterbridge.devices.clear();
    expect(aggregator.parts.size).toBe(0);
    expect(matterbridge.devices.size).toBe(0);
    await flushAsync();
  });

  it('should discover devices with command "down", "up" and "stop"', async () => {
    setMockDevice({ label: 'Device1', uniqueName: 'xxx', uiClass: 'xxx', commands: ['down', 'up', 'stop'] });
    clientGetDevicesSpy.mockImplementationOnce(() => {
      return Promise.resolve(mockDevices);
    });
    await somfyPlatform.discoverDevices();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma devices`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `- added with commands "down", "up" and "stop"`);
    expect(somfyPlatform.tahomaDevices).toHaveLength(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Discovered 1 TaHoma screens`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Adding device: ${BLUE}${mockDevices[0].label}${rs}`);
    expect(somfyPlatform.bridgedDevices).toHaveLength(1);
    expect(somfyPlatform.covers.size).toBe(1);
    somfyPlatform.sendCommand('identify', mockDevices[0]);
    somfyPlatform.sendCommand('open', mockDevices[0]);
    somfyPlatform.sendCommand('stop', mockDevices[0]);
    somfyPlatform.sendCommand('close', mockDevices[0]);
    expect(somfyPlatform.size()).toBe(1);
    expect(aggregator.parts.size).toBe(1);
    expect(matterbridge.devices.size).toBe(1);
    // We keep this device to be used in the next tests
  });

  it('should stop current movement in moveToPosition when already moving', async () => {
    const cover = somfyPlatform.covers.get('Device1');
    expect(cover).toBeDefined();
    if (!cover) return;

    await cover.bridgedDevice.setWindowCoveringCurrentTargetStatus(5000, 5000, WindowCovering.MovementStatus.Stopped);
    cover.movementStatus = WindowCovering.MovementStatus.Opening;
    cover.moveInterval = setInterval(() => {
      // noop
    }, 1000);

    await somfyPlatform.moveToPosition(cover, 8000);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopping current movement.');
    expect(clientExecuteSpy).toHaveBeenCalledWith('apply/highPriority', expect.anything());
    expect(cover.movementStatus).toBe(WindowCovering.MovementStatus.Stopped);
    expect(cover.moveInterval).toBeUndefined();
  });

  it('should send stop on stopMotion when movementStatus is not stopped', async () => {
    const cover = somfyPlatform.covers.get('Device1');
    expect(cover).toBeDefined();
    if (!cover) return;
    const device = cover.bridgedDevice;

    await cover.bridgedDevice.setWindowCoveringCurrentTargetStatus(5000, 5000, WindowCovering.MovementStatus.Stopped);
    cover.movementStatus = WindowCovering.MovementStatus.Opening;
    cover.moveInterval = setInterval(() => {
      // noop
    }, 1000);

    await device.executeCommandHandler('WindowCovering.stopMotion', {}, 'windowCovering', {} as any, device);

    expect(clientExecuteSpy).toHaveBeenCalledWith('apply/highPriority', expect.anything());
    expect(cover.movementStatus).toBe(WindowCovering.MovementStatus.Stopped);
  });

  it('should call onConfigure', async () => {
    await somfyPlatform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onConfigure called');
  });

  it('should call onConfigure and log error', async () => {
    const client = somfyPlatform.tahomaClient;
    somfyPlatform.tahomaClient = undefined;
    await somfyPlatform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onConfigure called');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'TaHoma service not created');
    somfyPlatform.tahomaClient = client;
  });

  it('should call onShutdown with reason', async () => {
    expect(aggregator.parts.size).toBe(1);
    const client = somfyPlatform.tahomaClient;
    somfyPlatform.tahomaClient = undefined;
    await somfyPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'Test reason');
    somfyPlatform.tahomaClient = client;
    expect(somfyPlatform.size()).toBe(0); // destroy called from onShutdown
    expect(aggregator.parts.size).toBe(1);
    expect(matterbridge.devices.size).toBe(1);
    expect(removeAllBridgedEndpointsSpy).toHaveBeenCalledTimes(0);
  });

  it('should call onShutdown with reason and call unregisterAll', async () => {
    const client = somfyPlatform.tahomaClient;
    somfyPlatform.tahomaClient = undefined;
    somfyPlatform.name = config.name as string;
    config.unregisterOnShutdown = true;
    await somfyPlatform.onShutdown();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'none');
    expect(removeAllBridgedEndpointsSpy).toHaveBeenCalledWith(config.name, 0);
    expect(somfyPlatform.tahomaClient).toBeUndefined();
    somfyPlatform.tahomaClient = client;
    config.unregisterOnShutdown = false;
    expect(somfyPlatform.size()).toBe(0);
    expect(aggregator.parts.size).toBe(0);
    expect(matterbridge.devices.size).toBe(0);
  });

  it('should call onShutdown with reason and log error', async () => {
    await somfyPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'Test reason');
  });
});
