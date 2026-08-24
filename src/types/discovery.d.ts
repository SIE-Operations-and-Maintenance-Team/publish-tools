declare type DiscoveryPrefix = {
  id: number | null;
  prefix: string;
  enabled: number; // 0/1
  isDefault: number; // 0/1
};

declare type DiscoveryMount = { Source: string; Destination: string };

declare type DiscoveryItem = {
  serviceName: string;
  displayName: string;
  rawPath: string;
  suggestedPublishPath: string;
  source: 'win32' | 'docker';
  containerId?: string;
  mounts?: DiscoveryMount[];
  image?: string;
};
