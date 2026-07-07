import { AgentResource } from "./resources/agents";
import { AuthResource } from "./resources/auth";
import { ConfigResource } from "./resources/config";
import { EventResource } from "./resources/events";
import { FileResource } from "./resources/files";
import { HealthResource } from "./resources/health";
import { MessageResource } from "./resources/messages";
import { ObservabilityResource } from "./resources/observability";
import { PermissionResource } from "./resources/permissions";
import { PlanResource } from "./resources/plans";
import { ProviderResource } from "./resources/providers";
import { SessionResource } from "./resources/sessions";
import { TokenHealthResource } from "./resources/token-health";
import { ToolResource } from "./resources/tools";
import { TuiResource } from "./resources/tui";
import { HttpTransport } from "./transport/http";

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
  public readonly agents: AgentResource;
  public readonly tokenHealth: TokenHealthResource;
  public readonly auth: AuthResource;
  public readonly plans: PlanResource;
  public readonly observability: ObservabilityResource;

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
    this.agents = new AgentResource(this.http);
    this.tokenHealth = new TokenHealthResource(this.http);
    this.auth = new AuthResource(this.http);
    this.plans = new PlanResource(this.http);
    this.observability = new ObservabilityResource(this.http);
  }
}
