import { HttpTransport } from "./transport/http";
import { SseTransport } from "./transport/sse";
import { HealthResource } from "./resources/health";
import { EventResource } from "./resources/events";
import { SessionResource } from "./resources/sessions";
import { MessageResource } from "./resources/messages";
import { ConfigResource } from "./resources/config";
import { ProviderResource } from "./resources/providers";
import { FileResource } from "./resources/files";
import { PermissionResource } from "./resources/permissions";
import { ToolResource } from "./resources/tools";
import { TuiResource } from "./resources/tui";
import { AuthResource } from "./resources/auth";

export interface WorkbenchClientOptions {
  baseUrl?: string;
}

export class WorkbenchClient {
  public readonly health: HealthResource;
  public readonly events: EventResource;
  public readonly sessions: SessionResource;
  public readonly messages: MessageResource;
  public readonly config: ConfigResource;
  public readonly providers: ProviderResource;
  public readonly files: FileResource;
  public readonly permissions: PermissionResource;
  public readonly tools: ToolResource;
  public readonly tui: TuiResource;
  public readonly auth: AuthResource;

  private http: HttpTransport;

  constructor(options: WorkbenchClientOptions = {}) {
    const baseUrl = options.baseUrl ?? "http://localhost:3000";
    this.http = new HttpTransport({ baseUrl });

    this.health = new HealthResource(this.http);
    this.events = new EventResource(this.http, baseUrl);
    this.sessions = new SessionResource(this.http);
    this.messages = new MessageResource(this.http);
    this.config = new ConfigResource(this.http);
    this.providers = new ProviderResource(this.http);
    this.files = new FileResource(this.http);
    this.permissions = new PermissionResource(this.http);
    this.tools = new ToolResource(this.http);
    this.tui = new TuiResource(this.http);
    this.auth = new AuthResource(this.http);
  }
}
