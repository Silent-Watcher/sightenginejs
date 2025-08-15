import type {
    ClientOptions,
    ImageModerationModels,
    ImageModerationResponse,
} from "./types";

export class SightEngineClient {
    private apiUser: string;
    private apiSecret: string;

    constructor(options: ClientOptions) {
        if (!options.apiUser || !options.apiSecret) {
            throw new TypeError(
                "[SightEngineClient] initialization error: both apiUser and apiSecret are required.",
            );
        }
        this.apiUser = options.apiUser;
        this.apiSecret = options.apiSecret;
    }

    async moderateImageByUrl(
        url: string,
        models: ImageModerationModels[] = ["nudity-2.1"],
    ): Promise<ImageModerationResponse> {
        if (!url) {
            throw new TypeError(
                "[SightEngineClient] image moderation by URL error: image url required",
            );
        }

        try {
            const params = new URLSearchParams({
                url,
                models: models.join(","),
                api_user: this.apiUser,
                api_secret: this.apiSecret,
            });

            const response = await fetch(
                `https://api.sightengine.com/1.0/check.json?${params}`,
                { method: "GET" },
            );

            return await response.json() as ImageModerationResponse;
        } catch (error) {
            throw new Error(
                `[SightEngineClient] url image moderation failed: ${
                    (error as Error).message
                }`,
            );
        }
    }
}
