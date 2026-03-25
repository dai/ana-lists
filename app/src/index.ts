import { handleApiRequest, type AppEnv } from "./server/app";

export default {
	async fetch(request: Request, env: AppEnv): Promise<Response> {
		return handleApiRequest(request, env);
	},
} satisfies ExportedHandler<AppEnv>;
